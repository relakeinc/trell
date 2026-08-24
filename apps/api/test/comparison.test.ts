import { describe, it, expect } from "vitest";
import { computeMetricsComparison, computeFunnelComparison } from "../src/analytics/comparison";
import { computeFunnel } from "../src/analytics/funnel";
import type { StoredEvent } from "../src/repositories/types";

function e(overrides: Partial<StoredEvent>): StoredEvent {
  return {
    eventId: "e1", type: "form_view", ts: new Date(), sessionId: "s1", visitorId: "v1",
    url: "https://example.com", referrer: null, pagePath: "/", pageTitle: null,
    utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null,
    deviceType: "desktop", os: null, browser: null, viewportWidth: null, viewportHeight: null,
    formId: null, formName: null, properties: null, raw: null,
    ...overrides,
  };
}

describe("computeMetricsComparison", () => {
  it("computes deltas between two periods", () => {
    const baseline = [
      e({ type: "form_view", sessionId: "s1" }),
      e({ type: "form_success", sessionId: "s1" }),
    ];
    const compare = [
      e({ type: "form_view", sessionId: "s1" }),
      e({ type: "form_view", sessionId: "s2" }),
      e({ type: "form_success", sessionId: "s1" }),
      e({ type: "form_success", sessionId: "s2" }),
    ];
    const result = computeMetricsComparison(baseline, compare);
    expect(result.baseline.events).toBe(2);
    expect(result.compare.events).toBe(4);
    expect(result.deltas.events.absolute).toBe(2);
    expect(result.deltas.events.direction).toBe("up");
    expect(result.deltas.events.percentage).toBeCloseTo(100);
  });

  it("handles baseline 0", () => {
    const baseline: StoredEvent[] = [];
    const compare = [e({ type: "form_view", sessionId: "s1" })];
    const result = computeMetricsComparison(baseline, compare);
    expect(result.deltas.events.absolute).toBe(1);
    expect(result.deltas.events.percentage).toBeNull();
  });

  it("flat when identical", () => {
    const events = [e({ type: "form_view", sessionId: "s1" })];
    const result = computeMetricsComparison(events, [...events]);
    expect(result.deltas.events.direction).toBe("flat");
    expect(result.deltas.events.absolute).toBe(0);
  });
});

describe("computeFunnelComparison", () => {
  it("compares two funnel results", () => {
    const events1 = [
      e({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      e({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
      e({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s1", type: "form_success" }),
    ];
    const events2 = [
      e({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s1", type: "form_view" }),
      e({ ts: new Date("2025-01-01T10:00:00Z"), sessionId: "s2", type: "form_view" }),
      e({ ts: new Date("2025-01-01T10:01:00Z"), sessionId: "s1", type: "form_start" }),
      e({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s1", type: "form_success" }),
      e({ ts: new Date("2025-01-01T10:02:00Z"), sessionId: "s2", type: "form_success" }),
    ];
    const steps = [
      { id: "s0", funnelId: "f", eventType: "form_view", formId: null, label: null, position: 0 },
      { id: "s1", funnelId: "f", eventType: "form_start", formId: null, label: null, position: 1 },
      { id: "s2", funnelId: "f", eventType: "form_success", formId: null, label: null, position: 2 },
    ];
    const r1 = computeFunnel(events1, steps);
    const r2 = computeFunnel(events2, steps);
    const result = computeFunnelComparison(r1, r2);
    expect(result.stepDeltas).toHaveLength(3);
    expect(result.stepDeltas[0]!.baselineCount).toBe(1);
    expect(result.stepDeltas[0]!.compareCount).toBe(2);
    expect(result.stepDeltas[0]!.countDelta.direction).toBe("up");
  });
});
