import { describe, it, expect } from "vitest";
import { eventLabel, metricLabel, metricHelp } from "@/lib/labels";

describe("product language", () => {
  it("maps internal event names to friendly labels", () => {
    expect(eventLabel("form_view")).toBe("Form views");
    expect(eventLabel("form_start")).toBe("Form starts");
    expect(eventLabel("form_submit")).toBe("Submissions");
    expect(eventLabel("form_success")).toBe("Conversions");
    expect(eventLabel("form_abandon")).toBe("Abandonments");
    expect(eventLabel("field_interaction")).toBe("Field interactions");
    expect(eventLabel("cta_click")).toBe("CTA clicks");
  });

  it("falls back to the raw name for unknown events", () => {
    expect(eventLabel("custom_event")).toBe("custom_event");
  });

  it("maps metric keys to user-friendly labels", () => {
    expect(metricLabel("conversionRate")).toBe("Conversion rate");
    expect(metricLabel("startConversionRate")).toBe("Completion after start");
  });

  it("explains the two conversion-like metrics differently", () => {
    const conv = metricHelp("conversionRate")!;
    const complete = metricHelp("startConversionRate")!;
    expect(conv).toContain("form views");
    expect(complete).toContain("form starts");
    expect(conv).not.toBe(complete);
  });
});
