import { describe, it, expect } from "vitest";
import { buildEvent, type BuildArgs } from "../src/payload";
import type { Context } from "../src/context";

function baseArgs(over: Partial<BuildArgs> = {}): BuildArgs {
  const context: Context = {
    visitorId: "vid-1",
    sessionId: "sid-1",
    utm: null,
    device: { type: "desktop", os: "linux", browser: "chrome", viewport: [800, 600] },
  };
  return {
    project: "pk_test",
    context,
    url: { url: "https://x.com/a", referrer: "https://google.com", page: { path: "/a", title: "A" } },
    defaults: {},
    identityProps: {},
    type: "form_view",
    now: 1_700_000_000_000,
    ...over,
  };
}

describe("buildEvent (payload)", () => {
  it("fills the base envelope", () => {
    const ev = buildEvent(baseArgs({ type: "form_start", form: { id: "c" } })) as unknown as Record<string, unknown>;
    expect(ev.v).toBe(1);
    expect(ev.project).toBe("pk_test");
    expect(ev.type).toBe("form_start");
    expect(ev.ts).toBe(1_700_000_000_000);
    expect(ev.session_id).toBe("sid-1");
    expect(ev.visitor_id).toBe("vid-1");
    expect(ev.url).toBe("https://x.com/a");
    expect(ev.referrer).toBe("https://google.com");
    expect(ev.page).toEqual({ path: "/a", title: "A" });
    expect(ev.utm).toBeNull();
    expect(ev.device).toEqual({ type: "desktop", os: "linux", browser: "chrome", viewport: [800, 600] });
    expect(String(ev.event_id)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("merges properties defaults < identity < options", () => {
    const ev = buildEvent(
      baseArgs({
        type: "form_start",
        form: { id: "c" },
        defaults: { a: 1, shared: "default" },
        identityProps: { b: 2, shared: "identity" },
      }),
    );
    const props = (ev as { properties: Record<string, unknown> }).properties;
    expect(props.a).toBe(1);
    expect(props.b).toBe(2);
    expect(props.shared).toBe("identity");
  });

  it("maps options.value into properties.value", () => {
    const ev = buildEvent(baseArgs({ type: "form_start", form: { id: "c" }, options: { value: 42 } }));
    expect((ev as { properties: Record<string, unknown> }).properties.value).toBe(42);
  });

  it("carries the form context", () => {
    const ev = buildEvent(baseArgs({ type: "form_submit", form: { id: "checkout", name: "Checkout" }, extra: { valid: true } }));
    const e = ev as { form: { id: string; name: string }; valid: boolean };
    expect(e.form.id).toBe("checkout");
    expect(e.form.name).toBe("Checkout");
    expect(e.valid).toBe(true);
  });

  it("builds cta_click with options.cta", () => {
    const ev = buildEvent(baseArgs({ type: "cta_click", options: { cta: "pricing" } }));
    expect((ev as { cta: string }).cta).toBe("pricing");
  });
});
