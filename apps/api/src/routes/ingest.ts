import type { Context } from "hono";
import type { ApiConfig } from "../config";
import type { Repo } from "../repositories/types";
import { RateLimiter } from "../middleware/ratelimit";
import { payloadTooLarge, sendError, sendOk, tooMany } from "../lib/errors";
import { parseAndValidate, toStoredEvent, BatchTooLargeError, InvalidEventError } from "../validation";
import { deliverWebhooks } from "../lib/webhook-delivery";

const PLAN_LIMITS = {
  free: { events: 5000 },
  pro: { events: 100000 },
} as const;

export interface IngestDeps {
  repo: Repo;
  config: ApiConfig;
  limiter?: RateLimiter;
}

function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function makeIngest(deps: IngestDeps): { handler: (c: Context) => Promise<Response>; preflight: (c: Context) => Promise<Response> } {
  const limiter = deps.limiter ?? new RateLimiter(deps.config.rateLimitMax, deps.config.rateLimitWindowMs);
  const maxBodyBytes = deps.config.maxBodyBytes;
  const maxBatch = deps.config.maxBatch;

  return {
    preflight: (c) => {
      const origin = c.req.header("origin");
      if (origin) c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      c.header("Access-Control-Allow-Headers", "content-type, authorization");
      c.header("Access-Control-Max-Age", "86400");
      return Promise.resolve(c.body(null, 204 as never));
    },

    handler: async (c) => {
      try {
        const contentLength = Number(c.req.header("content-length") ?? "0");
        if (contentLength > maxBodyBytes) return payloadTooLarge(c);

        const projectId = c.get("projectId");
        const project = c.get("project");
        const rl = limiter.check(`${projectId}:${clientIp(c)}`);
        if (!rl.allowed) return tooMany(c, rl.retryAfterMs);

        // Check event limit
        const plan = project.plan ?? "free";
        const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.events ?? PLAN_LIMITS.free.events;
        const count = await deps.repo.countEventsForAnalytics(projectId, {});
        if (count >= limit) {
          return sendError(c, 403, "limit_reached", `Event limit reached (${limit}). Upgrade to Pro for more.`);
        }

        const body = await c.req.json();
        if (JSON.stringify(body).length > maxBodyBytes) return payloadTooLarge(c);

        const events = parseAndValidate(body, maxBatch);
        if (events.length === 0) return sendOk(c, 202, { inserted: 0, duplicates: 0 });

        const stored = events.map(toStoredEvent);
        const result = await deps.repo.insertEvents({ projectId, events: stored });

        // Deliver webhooks async (don't block response)
        const webhookEvents = events.filter((e) =>
          ["form_submit", "cta_click", "form_abandon"].includes(e.type),
        );
        if (webhookEvents.length > 0) {
          Promise.allSettled(
            webhookEvents.map((e) =>
              deliverWebhooks(projectId, e.type, {
                event_id: e.id,
                type: e.type,
                page: e.page,
                form_id: e.form_id,
                properties: e.properties,
                visitor_id: e.visitor_id,
                session_id: e.session_id,
                timestamp: e.ts,
              }),
            ),
          ).catch(() => {});
        }

        return sendOk(c, 202, { inserted: result.inserted, duplicates: result.duplicates });
      } catch (e) {
        if (e instanceof BatchTooLargeError) return sendError(c, 413, "batch_too_large", e.message);
        if (e instanceof InvalidEventError) {
          const detail = firstZodMessage(e.cause) ?? "invalid_event";
          return sendError(c, 400, "invalid_event", detail);
        }
        throw e;
      }
    },
  };
}

function firstZodMessage(cause: unknown): string | null {
  if (cause && typeof cause === "object" && "issues" in (cause as object)) {
    const first = ((cause as { issues: unknown[] }).issues[0] ?? null) as { message?: string } | null;
    return first?.message ?? null;
  }
  return null;
}
