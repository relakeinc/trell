import { describe, it, expect } from "vitest";
import { computeFunnel } from "../src/analytics/funnel";
import type { StoredEvent } from "../src/repositories/types";

function makeEvent(overrides: Partial<StoredEvent> & { ts: Date; sessionId: string; type: string }): StoredEvent {
  return {
    eventId: `evt_${Math.random().toString(36).slice(2)}`,
    visitorId: "v1",
    url: "https://example.com",
    referrer: null,
    pagePath: "/",
    pageTitle: null,
    utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null,
    deviceType: "desktop", os: null, browser: null, viewportWidth: null, viewportHeight: null,
    formId: null, formName: null, properties: null, raw: null,
    ...overrides,
  };
}

function steps(events: StoredEvent[], types: string[]) {
  return types.map((eventType, position) => ({
    id: `step_${position}`,
    funnelId: "test",
    eventType,
    formId: null,
    label: null,
    position,
  }));
}

describe("computeFunnel (in-memory)", () => {
  it("empty events → 0 sessions, all steps 0", () => {
    const result = computeFunnel([], steps([], ["form_view", "form_start"]));
    expect(result.totalSessions).toBe(0);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.count).toBe(0);
  });

  it("single session completing all steps", () => {
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
      makeEvent({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s1", type: "form_success" }),
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_success"]));
    expect(result.totalSessions).toBe(1);
    expect(result.steps[0]!.count).toBe(1);
    expect(result.steps[1]!.count).toBe(1);
    expect(result.steps[2]!.count).toBe(1);
    expect(result.steps[1]!.conversionFromPrevious).toBe(1);
    expect(result.steps[2]!.conversionFromPrevious).toBe(1);
  });

  it("session drops at step 2", () => {
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
      // no form_success
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_success"]));
    expect(result.totalSessions).toBe(1);
    expect(result.steps[0]!.count).toBe(1);
    expect(result.steps[1]!.count).toBe(1);
    expect(result.steps[2]!.count).toBe(0);
    expect(result.steps[2]!.dropOff).toBe(1);
  });

  it("enforces strict temporal ordering (form_start before form_view → doesn't count)", () => {
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:05:00Z"), sessionId: "s1", type: "form_start" }),
      makeEvent({ ts: new Date("2025-01-01T10:10:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:20:00Z"), sessionId: "s1", type: "form_success" }),
    ];
    // Funnel: form_view → form_start → form_success
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_success"]));
    // form_view at 10:10, form_start at 10:05 (before form_view) → not counted for step 2
    expect(result.steps[0]!.count).toBe(1); // form_view ✓
    expect(result.steps[1]!.count).toBe(0); // form_start at 10:05 < form_view at 10:10 → drop
  });

  it("two candidates for same step → picks first after prev", () => {
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
      makeEvent({ ts: new Date("2025-01-01T10:03:00Z"), sessionId: "s1", type: "form_start" }), // duplicate
      makeEvent({ ts: new Date("2025-01-01T10:05:00Z"), sessionId: "s1", type: "form_success" }),
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_success"]));
    expect(result.steps[0]!.count).toBe(1);
    expect(result.steps[1]!.count).toBe(1); // picks 10:01
    expect(result.steps[2]!.count).toBe(1); // picks 10:05 (after 10:01)
  });

  it("same timestamp across steps → doesn't advance (ts must be > prevTs)", () => {
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_start" }), // same ts
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start"]));
    expect(result.steps[0]!.count).toBe(1);
    expect(result.steps[1]!.count).toBe(0); // 10:00:00 is NOT > 10:00:00
  });

  it("multiple sessions with different outcomes", () => {
    const events = [
      // s1: completes all
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
      makeEvent({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s1", type: "form_success" }),
      // s2: drops after step 1
      makeEvent({ ts: new Date("2025-01-01T11:00:00Z"), sessionId: "s2", type: "form_view" }),
      // s3: drops after step 2
      makeEvent({ ts: new Date("2025-01-01T12:00:00Z"), sessionId: "s3", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T12:01:00Z"), sessionId: "s3", type: "form_start" }),
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_success"]));
    expect(result.totalSessions).toBe(3);
    expect(result.steps[0]!.count).toBe(3);
    expect(result.steps[1]!.count).toBe(2);
    expect(result.steps[2]!.count).toBe(1);
    expect(result.steps[1]!.conversionFromPrevious).toBeCloseTo(2 / 3);
    expect(result.steps[2]!.conversionFromPrevious).toBeCloseTo(0.5);
  });

  it("formId-specific step", () => {
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view", formId: "checkout" }),
      makeEvent({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_view", formId: "other" }), // wrong form
      makeEvent({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s1", type: "form_success", formId: "checkout" }),
    ];
    const funnelSteps = [
      { id: "s0", funnelId: "f", eventType: "form_view", formId: "checkout", label: null, position: 0 },
      { id: "s1", funnelId: "f", eventType: "form_success", formId: "checkout", label: null, position: 1 },
    ];
    const result = computeFunnel(events, funnelSteps);
    expect(result.steps[0]!.count).toBe(1);
    expect(result.steps[1]!.count).toBe(1);
  });

  it("sessions that abandon at each stage", () => {
    const events = [
      // s1: drops at step 1
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      // s2: drops at step 2
      makeEvent({ ts: new Date("2025-01-01T11:00:00Z"), sessionId: "s2", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T11:01:00Z"), sessionId: "s2", type: "form_start" }),
      // s3: drops at step 3
      makeEvent({ ts: new Date("2025-01-01T12:00:00Z"), sessionId: "s3", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T12:01:00Z"), sessionId: "s3", type: "form_start" }),
      makeEvent({ ts: new Date("2025-01-01T12:02:00Z"), sessionId: "s3", type: "form_submit" }),
      // s4: completes all
      makeEvent({ ts: new Date("2025-01-01T13:00:00Z"), sessionId: "s4", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T13:01:00Z"), sessionId: "s4", type: "form_start" }),
      makeEvent({ ts: new Date("2025-01-01T13:02:00Z"), sessionId: "s4", type: "form_submit" }),
      makeEvent({ ts: new Date("2025-01-01T13:03:00Z"), sessionId: "s4", type: "form_success" }),
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_submit", "form_success"]));
    expect(result.totalSessions).toBe(4);
    expect(result.steps[0]!.count).toBe(4);
    expect(result.steps[1]!.count).toBe(3);
    expect(result.steps[2]!.count).toBe(2);
    expect(result.steps[3]!.count).toBe(1);
  });

  it("reordered events in session (out-of-order timestamps)", () => {
    // Events arrive out of order, but computeFunnel groups by session and sorts by ts
    const events = [
      makeEvent({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s1", type: "form_success" }),
      makeEvent({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      makeEvent({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
    ];
    const result = computeFunnel(events, steps(events, ["form_view", "form_start", "form_success"]));
    expect(result.steps[0]!.count).toBe(1);
    expect(result.steps[1]!.count).toBe(1);
    expect(result.steps[2]!.count).toBe(1);
  });
});
