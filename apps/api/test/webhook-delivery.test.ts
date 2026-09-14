import { describe, it, expect, vi, afterEach } from "vitest";
import type { WebhookStore } from "../src/lib/webhook-delivery";
import { deliverWebhooks, retryStuckDeliveries, mapWithConcurrency, DELIVERY_FANOUT } from "../src/lib/webhook-delivery";

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mockLookup }));

mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

const WEBHOOK = { id: "wh1", url: "https://hooks.test/trell", secret: "s3cr3t", enabled: true };

function okRes() {
  return { ok: true, status: 200, text: async () => "ok" };
}

function failRes() {
  return { ok: false, status: 500, text: async () => "boom" };
}

function makeStore() {
  const deliveries: Record<string, Record<string, unknown>> = {};
  let n = 0;
  const client = {
    webhook: { findMany: async () => [WEBHOOK] },
    webhookDelivery: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `d${++n}`;
        deliveries[id] = { id, ...data };
        return { id };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = deliveries[where.id]!;
        for (const [k, v] of Object.entries(data)) {
          row[k] =
            v !== null && typeof v === "object" && "increment" in (v as object)
              ? (row[k] as number) + (v as { increment: number }).increment
              : v;
        }
        return row;
      },
      findMany: async () => Object.values(deliveries),
    },
  } as unknown as WebhookStore;
  return { client, deliveries };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("webhook delivery retries", () => {
  it("waits 1s then 5s between the 3 attempts", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async () => failRes());
    vi.stubGlobal("fetch", fetchFn);
    const { client, deliveries } = makeStore();

    const p = deliverWebhooks("proj", "form_submit", { a: 1 }, client);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchFn).toHaveBeenCalledTimes(2); // attempt 1 failed → retry after 1s
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchFn).toHaveBeenCalledTimes(3); // attempt 2 failed → retry after 5s
    await p;

    const row = deliveries["d1"]!;
    expect(row["status"]).toBe("failed");
    expect(row["attempts"]).toBe(3);
  });

  it("marks success on retry with attempts counted", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchFn = vi.fn(async () => (++calls === 1 ? failRes() : okRes()));
    vi.stubGlobal("fetch", fetchFn);
    const { client, deliveries } = makeStore();

    const p = deliverWebhooks("proj", "form_submit", { a: 1 }, client);
    await vi.advanceTimersByTimeAsync(1_000);
    await p;

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const row = deliveries["d1"]!;
    expect(row["status"]).toBe("success");
    expect(row["attempts"]).toBe(2);
    expect(row["nextRetryAt"]).toBeNull();
  });

  it("signs the payload with HMAC-SHA256", async () => {
    const fetchFn = vi.fn(async () => okRes());
    vi.stubGlobal("fetch", fetchFn);
    const { client } = makeStore();

    await deliverWebhooks("proj", "form_submit", { a: 1 }, client);

    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Trell-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(headers["X-Trell-Event"]).toBe("form_submit");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["project_id"]).toBe("proj");
    expect(body["event"]).toBe("form_submit");
  });
});

describe("mapWithConcurrency", () => {
  it("never exceeds the lane limit and preserves order", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), DELIVERY_FANOUT, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(DELIVERY_FANOUT);
    expect(peak).toBeGreaterThan(1);
    expect(out).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
  });
});

describe("retryStuckDeliveries", () => {
  it("reprocesses a stuck pending row and marks it success", async () => {
    const fetchFn = vi.fn(async () => okRes());
    vi.stubGlobal("fetch", fetchFn);
    const stuck = {
      id: "d9",
      webhookId: "wh1",
      event: "form_submit",
      status: "pending",
      attempts: 1,
      nextRetryAt: new Date(Date.now() - 1_000),
      createdAt: new Date(Date.now() - 600_000),
      payload: JSON.stringify({ a: 1 }),
      webhook: WEBHOOK,
    };
    const updated: Record<string, unknown> = {};
    const client = {
      webhookDelivery: {
        findMany: async () => [stuck],
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(updated, data);
          return updated;
        },
      },
    } as unknown as WebhookStore;

    const n = await retryStuckDeliveries(client);
    expect(n).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(updated["status"]).toBe("success");
  });

  it("skips disabled webhooks", async () => {
    const fetchFn = vi.fn(async () => okRes());
    vi.stubGlobal("fetch", fetchFn);
    const client = {
      webhookDelivery: {
        findMany: async () => [
          {
            id: "d9",
            event: "form_submit",
            attempts: 0,
            payload: "{}",
            webhook: { ...WEBHOOK, enabled: false },
          },
        ],
        update: async () => ({}),
      },
    } as unknown as WebhookStore;

    const n = await retryStuckDeliveries(client);
    expect(n).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
