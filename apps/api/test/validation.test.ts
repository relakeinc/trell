import { describe, it, expect } from "vitest";
import { parseAndValidate, toStoredEvent, BatchTooLargeError, InvalidEventError } from "../src/validation";
import type { EventPayload } from "@trell/shared";

function validEvent(type = "form_submit", over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    event_id: "11111111-1111-4111-8111-111111111111",
    project: "pk_test",
    type,
    ts: 1_700_000_000_000,
    session_id: "sid",
    visitor_id: "vid",
    url: "https://example.com/a",
    page: { path: "/a", title: "A" },
    referrer: "https://google.com",
    utm: null,
    device: { type: "desktop", os: "linux", browser: "chrome", viewport: [800, 600] },
    properties: {},
    ...(type === "form_submit" ? { form: { id: "c" }, valid: true } : {}),
    ...over,
  };
}

describe("parseAndValidate", () => {
  it("accepts a single event object", () => {
    const out = parseAndValidate(validEvent(), 10);
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe("form_submit");
  });

  it("accepts a batch of events", () => {
    const out = parseAndValidate([validEvent(), validEvent("form_view")], 10);
    expect(out).toHaveLength(2);
  });

  it("rejects an invalid event (missing required field)", () => {
    const bad = validEvent();
    delete bad.project;
    expect(() => parseAndValidate(bad, 10)).toThrow(InvalidEventError);
  });

  it("rejects a batch larger than the maximum", () => {
    const batch = Array.from({ length: 11 }, () => validEvent());
    expect(() => parseAndValidate(batch, 10)).toThrow(BatchTooLargeError);
  });

  it("returns empty for an empty array", () => {
    expect(parseAndValidate([], 10)).toEqual([]);
  });
});

describe("toStoredEvent", () => {
  it("maps the SDK envelope to a persistable row", () => {
    const raw = validEvent("form_submit") as unknown as EventPayload;
    const stored = toStoredEvent(raw);
    expect(stored.eventId).toBe(raw.event_id);
    expect(stored.projectId).toBeUndefined();
    expect(stored.type).toBe("form_submit");
    expect(stored.ts).toEqual(new Date(raw.ts));
    expect(stored.sessionId).toBe("sid");
    expect(stored.visitorId).toBe("vid");
    expect(stored.pagePath).toBe("/a");
    expect(stored.utmSource).toBeNull();
    expect(stored.deviceType).toBe("desktop");
    expect(stored.viewportWidth).toBe(800);
    expect(JSON.parse(stored.properties!).form.id).toBe("c");
  });
});
