import { createHmac } from "node:crypto";
import { prisma } from "./prisma.js";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];

export async function deliverWebhooks(
  projectId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const webhooks = await prisma.webhook.findMany({
    where: { projectId, enabled: true, events: { has: event } },
  });

  if (webhooks.length === 0) return;

  const deliverables = webhooks.slice(0, 10); // cap at 10

  await Promise.allSettled(
    deliverables.map((wh) => deliverOne(wh, event, payload)),
  );
}

async function deliverOne(
  webhook: { id: string; url: string; secret: string },
  event: string,
  payload: Record<string, unknown>,
) {
  const delivery = await prisma.webhookDelivery.create({
    data: { webhookId: webhook.id, event, status: "pending" },
  });

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = createHmac("sha256", webhook.secret)
    .update(body)
    .digest("hex");

  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trell-Signature": `sha256=${signature}`,
          "X-Trell-Event": event,
          "X-Trell-Delivery": delivery.id,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await res.text().catch(() => "");

      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "success",
            statusCode: res.status,
            response: responseText.slice(0, 2000),
            attempts: attempt + 1,
          },
        });
        return;
      }

      lastError = `HTTP ${res.status}: ${responseText.slice(0, 200)}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    // schedule retry if not last attempt
    if (attempt < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS_MS[attempt + 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // all retries failed
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "failed",
      attempts: MAX_RETRIES,
      response: lastError?.slice(0, 2000) ?? "unknown error",
    },
  });
}
