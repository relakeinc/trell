import { describe, it, expect, vi, beforeEach } from "vitest";
import { init } from "../src/index";
import { TrellEngine } from "../src/engine";
import type { FormConfig } from "@trell/shared";

type FakeIO = {
  trigger: () => void;
  targets: Element[];
};
let instances: FakeIO[] = [];

class FakeIntersectionObserver {
  static instances: unknown[] = [];
  cb: IntersectionObserverCallback;
  targets: Element[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    instances.push(this as unknown as FakeIO);
  }
  observe(el: Element): void {
    this.targets.push(el);
  }
  unobserve(): void {}
  disconnect(): void {}
  trigger(): void {
    this.cb(this.targets.map((t) => ({ target: t, isIntersecting: true })) as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

function fakeRes(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
  } as unknown as Response;
}

beforeEach(() => {
  instances = [];
  document.body.innerHTML = `
    <form data-trell-form="c" id="f" data-trell-name="Contacto"><input name="email"><button type="submit">Enviar</button></form>
    <button data-trell-cta="pricing">Ver pricing</button>
  `;
  Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
  Object.defineProperty(navigator, "sendBeacon", { value: vi.fn(() => true), configurable: true });
});

function makeEngine() {
  const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(204));
  const trell = init(
    { project: "pk_test", endpoint: "https://e.trell/v1/events" },
    { win: window as unknown as Window, fetchFn: fetchFn as unknown as typeof fetch, beaconFn: vi.fn(() => true) as unknown as (url: string, data: BodyInit) => boolean },
  ) as TrellEngine;
  return { fetchFn, trell };
}

function bodyOf(call: unknown[]): { type: string; form?: { id: string }; valid?: boolean; properties?: Record<string, unknown> } {
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string)[0] as never;
}

describe("TrellEngine (integration)", () => {
  it("auto-detects form_submit from a declarative form", async () => {
    const { fetchFn, trell } = makeEngine();
    document.getElementById("f")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    const ev = bodyOf(fetchFn.mock.calls[0]!);
    expect(ev.type).toBe("form_submit");
    expect(ev.form?.id).toBe("c");
    expect(ev.valid).toBe(true);
  });

  it("emits field_interaction on change", async () => {
    const { fetchFn, trell } = makeEngine();
    const input = document.querySelector<HTMLInputElement>("#f input")!;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await trell.flushNow();

    const ev = bodyOf(fetchFn.mock.calls[0]!);
    expect(ev.type).toBe("field_interaction");
    expect(ev.form?.id).toBe("c");
  });

  it("emits cta_click on a data-trell-cta button", async () => {
    const { fetchFn, trell } = makeEngine();
    document.querySelector('[data-trell-cta="pricing"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await trell.flushNow();

    const calls = fetchFn.mock.calls.filter((c) => {
      const init = c[1] as RequestInit;
      return JSON.parse(init.body as string)[0].type === "cta_click";
    });
    expect(calls.length).toBeGreaterThan(0);
  });

  it("emits form_view when the form enters the viewport", async () => {
    const { fetchFn, trell } = makeEngine();
    const io = instances[instances.length - 1]!;
    io.trigger();
    await trell.flushNow();

    const calls = fetchFn.mock.calls.filter((c) => {
      const init = c[1] as RequestInit;
      return JSON.parse(init.body as string)[0].type === "form_view";
    });
    expect(calls.length).toBeGreaterThan(0);
  });

  it("merges identify() properties into events", async () => {
    const { fetchFn, trell } = makeEngine();
    trell.identify({ userId: "u_1" });
    trell.track("form_success", { form: "c", properties: { plan: "pro" } });
    await trell.flushNow();

    const ev = bodyOf(fetchFn.mock.calls[0]!);
    expect(ev.type).toBe("form_success");
    expect(ev.form?.id).toBe("c");
    expect(ev.properties?.plan).toBe("pro");
    expect(ev.properties?.identify_user).toMatch(/^[0-9a-f]{64}$/);
  });

  it("form().success() confirms success", async () => {
    const { fetchFn, trell } = makeEngine();
    const handle = trell.form({ id: "c", selector: "#f" } as FormConfig);
    handle.success({ properties: { plan: "pro" } });
    await trell.flushNow();

    const ev = bodyOf(fetchFn.mock.calls[0]!);
    expect(ev.type).toBe("form_success");
    expect(ev.form?.id).toBe("c");
    expect(ev.properties?.plan).toBe("pro");
  });
});
