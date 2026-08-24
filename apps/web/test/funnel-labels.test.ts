import { describe, it, expect } from "vitest";
import { funnelLabel, comparisonLabel } from "@/lib/labels";

describe("funnel labels", () => {
  it("maps known funnel keys", () => {
    expect(funnelLabel("conversionRate")).toBe("Step conversion");
    expect(funnelLabel("dropOff")).toBe("Drop-off");
    expect(funnelLabel("totalSessions")).toBe("Total sessions");
  });

  it("returns raw key for unknown", () => {
    expect(funnelLabel("unknown")).toBe("unknown");
  });
});

describe("comparison labels", () => {
  it("maps known comparison keys", () => {
    expect(comparisonLabel("baseline")).toBe("Previous period");
    expect(comparisonLabel("compare")).toBe("Current period");
    expect(comparisonLabel("up")).toBe("Increase");
    expect(comparisonLabel("down")).toBe("Decrease");
    expect(comparisonLabel("flat")).toBe("No change");
  });

  it("returns raw key for unknown", () => {
    expect(comparisonLabel("xyz")).toBe("xyz");
  });
});
