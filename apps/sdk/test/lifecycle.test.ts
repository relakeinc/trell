import { describe, it, expect, vi, beforeEach } from "vitest";
import { init } from "../src/index";
import { TrellEngine } from "../src/engine";

function fakeRes(status: number): Response {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null } } as unknown as Response;
}

function makeEngine() {
  const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(204));
  Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const trell = init(
    { project: "pk_test", endpoint: "https://e.trell/v1/events", autoDetect: true },
    { win: window as unknown as Window, fetchFn: fetchFn as unknown as typeof fetch, beaconFn: (() => true) as unknown as (url: string, data: BodyInit) => boolean },
  ) as TrellEngine;
  return { fetchFn, trell };
}

function submitCount(fetchFn: ReturnType<typeof vi.fn>): number {
  let n = 0;
  for (const call of fetchFn.mock.calls) {
    const body = JSON.parse((call[1]! as RequestInit).body as string) as { type: string }[];
    for (const e of body) if (e.type === "form_submit") n++;
  }
  return n;
}

let fetchFn: ReturnType<typeof vi.fn>;
let trell: TrellEngine;

beforeEach(() => {
  document.body.innerHTML = '<form id="f" data-trell-form="f"><input name="email"><button type="submit">x</button></form>';
  const env = makeEngine();
  fetchFn = env.fetchFn;
  trell = env.trell;
});

const dispatchSubmit = () => document.getElementById("f")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const tick = () => new Promise((r) => setTimeout(r, 10));

describe("form().destroy() lifecycle", () => {
  it("removes listeners so a dispatch after destroy does not emit", async () => {
    const handle = trell.form({ id: "f", selector: "#f" });
    dispatchSubmit();
    await tick();
    const afterRegister = submitCount(fetchFn);

    handle.destroy();
    dispatchSubmit();
    await tick();
    const afterDestroy = submitCount(fetchFn);

    expect(afterRegister).toBe(1);
    expect(afterDestroy).toBe(afterRegister); // no duplicate after destroy
  });

  it("allows destroy then re-init without duplicating events", async () => {
    const h1 = trell.form({ id: "f", selector: "#f" });
    dispatchSubmit();
    await tick();
    h1.destroy();

    // re-init (fresh handle, same id)
    trell.form({ id: "f", selector: "#f" });
    dispatchSubmit();
    await tick();

    // exactly 2 submits: 1 from before destroy, 1 from the re-initialized form
    expect(submitCount(fetchFn)).toBe(2);
  });

  it("does not duplicate listeners when registering the same id twice", async () => {
    trell.form({ id: "f", selector: "#f" });
    trell.form({ id: "f", selector: "#f" });
    dispatchSubmit();
    await tick();
    // only one listener fired → exactly 1 submit
    expect(submitCount(fetchFn)).toBe(1);
  });

  it("keeps working after destroy() on the whole engine", async () => {
    const handle = trell.form({ id: "f", selector: "#f" });
    dispatchSubmit();
    await tick();
    const before = submitCount(fetchFn);
    trell.destroy();
    dispatchSubmit();
    await tick();
    expect(submitCount(fetchFn)).toBe(before);
    void handle;
  });
});
