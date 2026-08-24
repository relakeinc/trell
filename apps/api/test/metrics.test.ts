import { describe, it, expect } from "vitest";
import { computeMetrics, computeSeries, computeBreakdown, buildFilter } from "../src/analytics/metrics";
import type { StoredEvent } from "../src/repositories/types";

function ev(over: Partial<StoredEvent> = {}): StoredEvent {
  return {
    eventId: "11111111-1111-4111-8111-111111111111",
    type: "form_view",
    ts: new Date("2026-01-05T10:00:00Z"),
    sessionId: "s1",
    visitorId: "v1",
    url: "https://example.com/a",
    referrer: "https://google.com",
    pagePath: "/a",
    pageTitle: "A",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    deviceType: "mobile",
    os: "ios",
    browser: "safari",
    viewportWidth: 390,
    viewportHeight: 844,
    formId: null,
    formName: null,
    properties: null,
    raw: null,
    ...over,
  };
}

describe("computeMetrics", () => {
  it("counts events, sessions and visitors", () => {
    const events = [
      ev({ type: "form_view" }),
      ev({ type: "form_view", sessionId: "s2", visitorId: "v2", eventId: "e2" }),
      ev({ type: "cta_click", eventId: "e3" }),
    ];
    const m = computeMetrics(events);
    expect(m.events).toBe(3);
    expect(m.views).toBe(2);
    expect(m.ctaClicks).toBe(1);
    expect(m.sessions).toBe(2);
    expect(m.visitors).toBe(2);
  });

  it("computes conversion rate and per-metric counts", () => {
    const events = [
      ev({ type: "form_view" }),
      ev({ type: "form_view", eventId: "e2" }),
      ev({ type: "form_start", eventId: "e3", formId: "c" }),
      ev({ type: "form_submit", eventId: "e4", formId: "c" }),
      ev({ type: "form_success", eventId: "e5", formId: "c" }),
      ev({ type: "form_abandon", eventId: "e6", formId: "c" }),
    ];
    const m = computeMetrics(events);
    expect(m.starts).toBe(1);
    expect(m.submits).toBe(1);
    expect(m.successes).toBe(1);
    expect(m.abandons).toBe(1);
    expect(m.conversionRate).toBeCloseTo(0.5); // 1/2 views
    expect(m.startConversionRate).toBeCloseTo(1);
  });

  it("computes avg time to complete across session+form groups", () => {
    const events = [
      ev({ type: "form_start", eventId: "s1", sessionId: "s1", formId: "c", ts: new Date("2026-01-05T10:00:00Z") }),
      ev({ type: "form_success", eventId: "r1", sessionId: "s1", formId: "c", ts: new Date("2026-01-05T10:00:10Z") }),
      ev({ type: "form_start", eventId: "s2", sessionId: "s2", formId: "c", ts: new Date("2026-01-05T10:00:05Z") }),
      ev({ type: "form_success", eventId: "r2", sessionId: "s2", formId: "c", ts: new Date("2026-01-05T10:00:15Z") }),
      ev({ type: "form_start", eventId: "s3", sessionId: "s3", formId: "c", ts: new Date("2026-01-05T11:00:00Z") }), // no success
    ];
    const m = computeMetrics(events);
    // 10s and 10s -> avg 10000ms
    expect(m.avgTimeToCompleteMs).toBeCloseTo(10_000);
  });

  it("returns null conversion rate when there are no views", () => {
    const m = computeMetrics([ev({ type: "form_submit", formId: "c" })]);
    expect(m.conversionRate).toBeNull();
  });
});

describe("computeSeries", () => {
  it("buckets by day", () => {
    const events = [
      ev({ ts: new Date("2026-01-05T10:00:00Z") }),
      ev({ ts: new Date("2026-01-05T23:00:00Z"), eventId: "e2" }),
      ev({ ts: new Date("2026-01-06T01:00:00Z"), eventId: "e3" }),
    ];
    const series = computeSeries(events, "day");
    expect(series).toHaveLength(2);
    expect(series[0]!.views).toBe(2);
    expect(series[1]!.views).toBe(1);
    expect(series[0]!.date).toBe("2026-01-05T00:00:00.000Z");
  });
});

describe("computeBreakdown", () => {
  it("groups by a dimension and computes percentages", () => {
    const events = [
      ev({ utmSource: "google", pagePath: "/a" }),
      ev({ utmSource: "google", pagePath: "/a", eventId: "e2" }),
      ev({ utmSource: "twitter", pagePath: "/b", eventId: "e3" }),
    ];
    const rows = computeBreakdown(events, "utm_source");
    expect(rows[0]).toMatchObject({ key: "google", count: 2 });
    expect(rows[0]!.percentage).toBeCloseTo(2 / 3);
    expect(rows[1]!.key).toBe("twitter");
  });

  it("maps 'form' dimension to formId", () => {
    const rows = computeBreakdown([ev({ formId: "checkout" }), ev({ formId: "checkout", eventId: "e2" })], "form");
    expect(rows).toEqual([{ key: "checkout", count: 2, percentage: 1 }]);
  });
});

describe("buildFilter", () => {
  it("parses from/to/type and ignores invalid dates", () => {
    const f = buildFilter({ from: "2026-01-01", to: "not-a-date", type: "form_view,form_start" });
    expect(f.from).toBeInstanceOf(Date);
    expect(f.to).toBeUndefined();
    expect(f.type).toEqual(["form_view", "form_start"]);
  });
});
