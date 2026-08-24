import { describe, it, expect } from "vitest";
import { getSessionSegment, filterEvents } from "../src/analytics/segmentation";
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

describe("getSessionSegment", () => {
  it("no segment → all sessions qualify", () => {
    const events = [e({ sessionId: "s1" }), e({ sessionId: "s2" })];
    const result = getSessionSegment(events, undefined);
    expect(result).toEqual(new Set(["s1", "s2"]));
  });

  it("empty segment → all sessions qualify", () => {
    const events = [e({ sessionId: "s1" })];
    const result = getSessionSegment(events, {});
    expect(result).toEqual(new Set(["s1"]));
  });

  it("session segment: session contains matching event → included", () => {
    const events = [
      e({ sessionId: "s1", pagePath: "/landing" }),
      e({ sessionId: "s1", pagePath: "/checkout" }),
      e({ sessionId: "s2", pagePath: "/other" }),
    ];
    const result = getSessionSegment(events, { page: "/landing" });
    expect(result).toEqual(new Set(["s1"]));
  });

  it("session segment: multiple dimensions", () => {
    const events = [
      e({ sessionId: "s1", pagePath: "/landing", deviceType: "mobile" }),
      e({ sessionId: "s2", pagePath: "/landing", deviceType: "desktop" }),
      e({ sessionId: "s3", pagePath: "/other", deviceType: "mobile" }),
    ];
    const result = getSessionSegment(events, { page: "/landing", device: "mobile" });
    expect(result).toEqual(new Set(["s1"]));
  });

  it("session segment: utm_source", () => {
    const events = [
      e({ sessionId: "s1", utmSource: "google" }),
      e({ sessionId: "s2", utmSource: "facebook" }),
    ];
    const result = getSessionSegment(events, { utmSource: "google" });
    expect(result).toEqual(new Set(["s1"]));
  });
});

describe("filterEvents (event filter)", () => {
  it("no filter → all events", () => {
    const events = [e({ pagePath: "/a" }), e({ pagePath: "/b" })];
    expect(filterEvents(events, undefined)).toHaveLength(2);
  });

  it("filters by page", () => {
    const events = [e({ pagePath: "/landing" }), e({ pagePath: "/checkout" })];
    expect(filterEvents(events, { page: "/landing" })).toHaveLength(1);
  });

  it("filters by device", () => {
    const events = [e({ deviceType: "mobile" }), e({ deviceType: "desktop" })];
    expect(filterEvents(events, { device: "mobile" })).toHaveLength(1);
  });

  it("session segment vs event filter: different results", () => {
    // Scenario: s1 has form_view on /landing, form_start on /checkout
    // Session segment (page=/landing) → s1 included, all 3 events visible
    // Event filter (page=/landing) → only form_view visible
    const events = [
      e({ sessionId: "s1", pagePath: "/landing", type: "form_view" }),
      e({ sessionId: "s1", pagePath: "/checkout", type: "form_start" }),
      e({ sessionId: "s1", pagePath: "/checkout", type: "form_success" }),
    ];
    const segment = getSessionSegment(events, { page: "/landing" });
    expect(segment.size).toBe(1); // s1 included
    const filtered = filterEvents(events, { page: "/landing" });
    expect(filtered).toHaveLength(1); // only form_view
  });
});
