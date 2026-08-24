import { describe, it, expect } from "vitest";
import { validateEvent, isEventType } from "../src/validate";
import type { EventPayload, FormContext } from "@trell/shared";

function base(): EventPayload {
  return {
    v: 1,
    event_id: "11111111-1111-4111-8111-111111111111",
    project: "pk_test",
    type: "form_submit",
    ts: 1_700_000_000_000,
    session_id: "sid",
    visitor_id: "vid",
    url: "https://x.com/a",
    page: { path: "/a", title: "A" },
    referrer: "",
    utm: null,
    device: { type: "desktop", os: "linux", browser: "chrome", viewport: [800, 600] },
    properties: {},
    form: { id: "c" } satisfies FormContext,
    valid: true,
  };
}

describe("validateEvent", () => {
  it("accepts a valid form_submit", () => {
    expect(validateEvent(base())).toBe(true);
  });

  it("rejects when required base fields are missing", () => {
    const e = base() as unknown as Record<string, unknown>;
    delete e.project;
    expect(validateEvent(e as unknown as EventPayload)).toBe(false);
  });

  it("rejects a field_interaction without field", () => {
    const e = base() as unknown as EventPayload & { field?: string; interaction?: string };
    e.type = "field_interaction";
    e.field = "";
    e.interaction = "focus";
    expect(validateEvent(e)).toBe(false);
  });

  it("rejects cta_click without cta", () => {
    const e = base() as unknown as EventPayload & { cta?: string };
    e.type = "cta_click";
    e.cta = "";
    expect(validateEvent(e)).toBe(false);
  });

  it("accepts form events only when they carry a form id", () => {
    const e = base() as unknown as EventPayload & { form?: FormContext };
    e.type = "form_view";
    e.form = undefined;
    expect(validateEvent(e)).toBe(false);
  });

  it("accepts custom event names", () => {
    const e = base() as unknown as EventPayload & { type: string };
    e.type = "my_custom_event";
    expect(validateEvent(e)).toBe(true);
  });

  it("classifies known event types", () => {
    expect(isEventType("form_submit")).toBe(true);
    expect(isEventType("custom")).toBe(false);
  });
});
