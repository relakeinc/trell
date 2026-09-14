import { createHmac } from "node:crypto";
import { checkWebhookTarget } from "./ssrf";

const MAX_RETRIES = 3;
/** Delay BEFORE retry N (N = attempts already made): 1s, then 5s. */
const RETRY_DELAYS_MS = [1_000, 5_000];
/** Sweep stuck deliveries (process died mid-retry) this often. */
const SWEEP_INTERVAL_MS = 60_000;
/** Rows stuck in pending with no nextRetryAt older than this get reprocessed. */
const STUCK_AFTER_MS = 5 * 60_000;

interface WebhookTarget {
  id: string;
  url: string;
  secret: string;
}

/**
 * Max concurrent outbound deliveries. Unbounded fan-out (one task per event
 * × webhooks per event) can open hundreds of sockets at once and stall the
 * event loop; a small pool keeps tail latency flat.
 */
export const DELIVERY_FANOUT = 5;

/**
 * Promise-pool mapper: runs `fn` over `items` with at most `limit` in flight,
 * preserving result order. Rejects if any `fn` rejects (wrap with .catch to
 * keep allSettled semantics).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!, i);
      }
    }),
  );
  return results;
}

/**
 * Narrow seam over the Prisma client so delivery logic is unit-testable and
 * the process shares a single injected client (see index.ts) instead of a
 * module-global singleton. `any` keeps it assignable to the real delegates.
 */
export interface WebhookStore {
  webhook: {
    findMany(args: any): Promise<any>;
  };
  webhookDelivery: {
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    findMany(args: any): Promise<any>;
  };
}

interface StuckDelivery {
  id: string;
  event: string;
  attempts: number;
  payload: string | null;
  webhook: (WebhookTarget & { enabled: boolean; projectId: string }) | null;
}

export async function deliverWebhooks(
  projectId: string,
  event: string,
  payload: Record<string, unknown>,
  store: WebhookStore,
) {
  const webhooks = (await store.webhook.findMany({
    where: { projectId, enabled: true, events: { has: event } },
  })) as WebhookTarget[];

  if (webhooks.length === 0) return;

  const deliverables = webhooks.slice(0, 10); // cap at 10

  await mapWithConcurrency(deliverables, DELIVERY_FANOUT, (wh) =>
    deliverOne(store, wh, projectId, event, payload).catch(() => {}),
  );
}

async function deliverOne(
  store: WebhookStore,
  webhook: WebhookTarget,
  projectId: string,
  event: string,
  payload: Record<string, unknown>,
  resume?: { id: string; attempts: number },
) {
  const body = JSON.stringify({
    event,
    project_id: projectId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const delivery = resume
    ? { id: resume.id }
    : ((await store.webhookDelivery.create({
        data: { webhookId: webhook.id, event, status: "pending", payload: JSON.stringify(payload) },
      })) as { id: string });

  const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

  let lastError: string | null = null;
  let attempt = resume?.attempts ?? 0;

  while (attempt < MAX_RETRIES) {
    const outcome = await attemptDelivery(store, delivery.id, webhook, event, body, signature);
    if (outcome === "success") return;
    if (outcome === "blocked") return; // marked failed permanently inside
    lastError = outcome.reason;

    attempt++;
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 30_000;
      await store.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts: attempt,
          nextRetryAt: new Date(Date.now() + delay),
          response: lastError?.slice(0, 2000) ?? "unknown error",
        },
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  await store.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "failed",
      attempts: MAX_RETRIES,
      nextRetryAt: null,
      response: lastError?.slice(0, 2000) ?? "unknown error",
    },
  });
}

/**
 * One delivery attempt. Follows up to 3 redirects manually so every hop is
 * re-validated against the SSRF gate (fetch's automatic redirect following
 * would bypass it).
 */
async function attemptDelivery(
  prisma: WebhookStore,
  deliveryId: string,
  webhook: WebhookTarget,
  event: string,
  body: string,
  signature: string,
): Promise<"success" | "blocked" | { reason: string }> {
  const headers = {
    "Content-Type": "application/json",
    "X-Trell-Signature": `sha256=${signature}`,
    "X-Trell-Event": event,
    "X-Trell-Delivery": deliveryId,
  };

  let currentUrl = webhook.url;
  for (let hop = 0; hop <= 3; hop++) {
    const verdict = await checkWebhookTarget(currentUrl);
    if (verdict.verdict === "blocked") {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "failed",
          nextRetryAt: null,
          response: `ssrf_blocked: ${verdict.reason ?? "private target"}`.slice(0, 2000),
        },
      });
      return "blocked";
    }
    if (verdict.verdict === "transient") {
      return { reason: `target unavailable: ${verdict.reason}` };
    }

    let res: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        res = await fetch(currentUrl, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
          redirect: "manual",
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: unknown) {
      return { reason: err instanceof Error ? err.message : String(err) };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      if (!location || hop === 3) {
        return { reason: location ? "too many redirects" : `HTTP ${res.status} without location` };
      }
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        return { reason: `invalid redirect location` };
      }
      continue;
    }

    const responseText = await res.text().catch(() => "");
    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "success",
          statusCode: res.status,
          response: responseText.slice(0, 2000),
          attempts: { increment: 1 },
          nextRetryAt: null,
        },
      });
      return "success";
    }
    return { reason: `HTTP ${res.status}: ${responseText.slice(0, 200)}` };
  }
  return { reason: "too many redirects" };
}

/**
 * Reprocess deliveries stuck in "pending" (process died mid-retry or
 * predates nextRetryAt tracking). Runs on a timer from index.ts.
 */
export async function retryStuckDeliveries(store: WebhookStore): Promise<number> {
  const now = new Date();
  const stuck = (await store.webhookDelivery.findMany({
    where: {
      status: "pending",
      OR: [
        { nextRetryAt: { lte: now } },
        { nextRetryAt: null, createdAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
      ],
    },
    include: { webhook: true },
    take: 50,
  })) as StuckDelivery[];

  let reprocessed = 0;
  for (const row of stuck) {
    if (!row.webhook || !row.webhook.enabled) continue;
    let payload: Record<string, unknown> = {};
    try {
      payload = row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }
    await deliverOne(store, row.webhook, row.webhook.projectId, row.event, payload, {
      id: row.id,
      attempts: row.attempts,
    }).catch(() => {});
    reprocessed++;
  }
  return reprocessed;
}

export const __testing = { MAX_RETRIES, RETRY_DELAYS_MS, SWEEP_INTERVAL_MS };
