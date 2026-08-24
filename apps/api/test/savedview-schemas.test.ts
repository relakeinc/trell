import { describe, it, expect } from "vitest";
import { validateSavedViewConfig, parseSavedViewConfig } from "../src/analytics/schemas";

describe("SavedView config schemas", () => {
  describe("validateSavedViewConfig", () => {
    it("valid funnel config", () => {
      const result = validateSavedViewConfig("funnel", { funnelId: "550e8400-e29b-41d4-a716-446655440000" });
      expect(result.type).toBe("funnel");
    });

    it("valid funnel config with segment", () => {
      const result = validateSavedViewConfig("funnel", {
        funnelId: "550e8400-e29b-41d4-a716-446655440000",
        segment: { page: "/landing" },
      });
      expect(result.type).toBe("funnel");
    });

    it("valid comparison config", () => {
      const result = validateSavedViewConfig("comparison", {
        baselineFrom: "2025-01-01T00:00:00Z",
        baselineTo: "2025-01-07T00:00:00Z",
        compareFrom: "2025-01-08T00:00:00Z",
        compareTo: "2025-01-14T00:00:00Z",
      });
      expect(result.type).toBe("comparison");
    });

    it("valid segment config", () => {
      const result = validateSavedViewConfig("segment", {
        dimension: "page",
        segment: { page: "/landing" },
      });
      expect(result.type).toBe("segment");
    });

    it("rejects invalid type", () => {
      expect(() => validateSavedViewConfig("unknown", {})).toThrow();
    });

    it("rejects funnel config without funnelId", () => {
      expect(() => validateSavedViewConfig("funnel", {})).toThrow();
    });

    it("rejects comparison config without required fields", () => {
      expect(() => validateSavedViewConfig("comparison", { baselineFrom: "2025-01-01" })).toThrow();
    });
  });

  describe("parseSavedViewConfig", () => {
    it("parses valid JSON", () => {
      const result = parseSavedViewConfig("funnel", JSON.stringify({ funnelId: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(result).not.toBeNull();
      expect(result!.type).toBe("funnel");
    });

    it("returns null on invalid JSON", () => {
      expect(parseSavedViewConfig("funnel", "not json")).toBeNull();
    });

    it("returns null on invalid config", () => {
      expect(parseSavedViewConfig("funnel", JSON.stringify({}))).toBeNull();
    });
  });
});
