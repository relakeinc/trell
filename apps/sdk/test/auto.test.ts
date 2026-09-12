import { describe, it, expect, vi, afterEach } from "vitest";
import { attachAuto, type AutoEmitter } from "../src/auto";

function makeForm(): { win: Window; form: HTMLElement; input: HTMLInputElement } {
  document.body.innerHTML =
    '<form data-trell-form="c"><input name="email" type="email"><input name="name" type="text"></form>';
  const form = document.querySelector<HTMLElement>('[data-trell-form="c"]')!;
  const input = form.querySelector<HTMLInputElement>('input[name="email"]')!;
  return { win: window as unknown as Window, form, input };
}

function makeEmitter() {
  const calls: { type: string; opts: { extra?: Record<string, unknown> } }[] = [];
  const emitter: AutoEmitter = {
    trackEvent: (type, opts) => {
      calls.push({ type, opts });
    },
  };
  return { emitter, calls };
}

const baseConfig = { id: "c", selector: '[data-trell-form="c"]' };

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("attachAuto interaction timing", () => {
  it("emits hesitationMs on first change after focus, without gapMs on first interaction", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));
    const { win, input } = makeForm();
    const { emitter, calls } = makeEmitter();
    const ctrl = attachAuto(win, emitter, { autoDetect: false });
    ctrl.register(baseConfig);

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    vi.setSystemTime(new Date("2026-01-05T10:00:01.500Z"));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const changes = calls.filter((c) => (c.opts.extra as Record<string, unknown>)?.["interaction"] === "change");
    expect(changes).toHaveLength(1);
    const props = (changes[0]!.opts.extra as Record<string, unknown>)["properties"] as Record<string, unknown>;
    expect(props["hesitationMs"]).toBe(1500);
    expect(props["gapMs"]).toBe(1500); // gap since the focus interaction
    ctrl.destroy();
  });

  it("emits gapMs between consecutive interactions without repeating hesitation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));
    const { win, input } = makeForm();
    const { emitter, calls } = makeEmitter();
    const ctrl = attachAuto(win, emitter, { autoDetect: false });
    ctrl.register(baseConfig);

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    vi.setSystemTime(new Date("2026-01-05T10:00:01Z"));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    vi.setSystemTime(new Date("2026-01-05T10:00:03Z"));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const changes = calls.filter((c) => (c.opts.extra as Record<string, unknown>)?.["interaction"] === "change");
    expect(changes).toHaveLength(2);
    const second = (changes[1]!.opts.extra as Record<string, unknown>)["properties"] as Record<string, unknown>;
    expect(second["gapMs"]).toBe(2000);
    expect(second).not.toHaveProperty("hesitationMs");
    ctrl.destroy();
  });

  it("throttles rapid refocus without emitting", () => {
    vi.useFakeTimers();
    const { win, input } = makeForm();
    const { emitter, calls } = makeEmitter();
    const ctrl = attachAuto(win, emitter, { autoDetect: false });
    ctrl.register(baseConfig);

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const focus = calls.filter((c) => (c.opts.extra as Record<string, unknown>)?.["interaction"] === "focus");
    expect(focus).toHaveLength(1);
    ctrl.destroy();
  });
});
