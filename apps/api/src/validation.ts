import type { EventPayload } from "@trell/shared";
import { eventSchema } from "@trell/shared/schemas";
import type { StoredEvent } from "./repositories/types";

/** Accepts a single event or an array (batch), validates each with zod, and cheks the max batch size. */
export function parseAndValidate(body: unknown, maxBatch: number): EventPayload[] {
  const list = Array.isArray(body) ? (body as unknown[]) : [body];

  if (list.length === 0) return [];
  if (list.length > maxBatch) {
    throw new BatchTooLargeError(list.length, maxBatch);
  }

  return list.map((raw) => {
    try {
      return eventSchema.parse(raw);
    } catch (e) {
      throw new InvalidEventError(e);
    }
  });
}

export class BatchTooLargeError extends Error {
  constructor(
    public count: number,
    public max: number,
  ) {
    super(`batch of ${count} exceeds the maximum of ${max} events`);
  }
}

export class InvalidEventError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super("invalid event payload");
    this.cause = cause;
  }
}

export function toStoredEvent(e: EventPayload): StoredEvent {
  const form = (e as EventPayload & { form?: { id?: string; name?: string } }).form;
  const device = e.device;
  return {
    eventId: e.event_id,
    type: e.type,
    ts: new Date(e.ts),
    sessionId: e.session_id,
    visitorId: e.visitor_id,
    url: e.url,
    referrer: e.referrer || null,
    pagePath: e.page?.path ?? "",
    pageTitle: e.page?.title ?? null,
    utmSource: e.utm?.source ?? null,
    utmMedium: e.utm?.medium ?? null,
    utmCampaign: e.utm?.campaign ?? null,
    utmTerm: e.utm?.term ?? null,
    utmContent: e.utm?.content ?? null,
    deviceType: device.type,
    os: device.os,
    browser: device.browser,
    viewportWidth: device.viewport?.[0] ?? null,
    viewportHeight: device.viewport?.[1] ?? null,
    formId: form?.id ?? null,
    formName: form?.name ?? null,
    properties: safeJson({ ...(e.properties ?? {}), form }),
    raw: safeJson(e),
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}
