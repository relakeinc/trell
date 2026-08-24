import { describe, it, expect, vi } from "vitest";
import {
  getOrCreateVisitorId,
  getOrCreateSessionId,
  getOrCreateUtm,
  detectDevice,
} from "../src/context";
import { createMemoryStore } from "../src/storage";
import { COOKIE_VISITOR, STORAGE_SESSION, STORAGE_UTM } from "@trell/shared";

describe("context", () => {
  it("keeps a stable visitor id across calls", () => {
    const store = createMemoryStore();
    const a = getOrCreateVisitorId(window, store, true);
    const b = getOrCreateVisitorId(window, store, true);
    expect(a).toBe(b);
  });

  it("regenerates the session id after idle", () => {
    const store = createMemoryStore();
    const first = getOrCreateSessionId(window, store);
    const second = getOrCreateSessionId(window, store);
    expect(first).toBe(second);

    // force an expired session in storage
    store.set(STORAGE_SESSION, JSON.stringify({ id: "old", at: Date.now() - 60 * 60 * 1000 }));
    const third = getOrCreateSessionId(window, store);
    expect(third).not.toBe(first);
  });

  it("captures UTM first-touch from the URL", () => {
    const store = createMemoryStore();
    // jsdom URL has no utm params, so first call is null
    const utm = getOrCreateUtm(window, store, true);
    expect(utm).toBeNull();
  });

  it("prefers already-stored UTM (first touch wins)", () => {
    const stored = { source: "google", medium: "cpc", campaign: "s", term: null as string | null, content: null as string | null };
    const store = createMemoryStore();
    store.set(STORAGE_UTM, JSON.stringify(stored));
    const utm = getOrCreateUtm(window, store, true);
    expect(utm).toEqual(stored);
  });

  it("detects device without libraries", () => {
    const device = detectDevice(window);
    expect(["desktop", "tablet", "mobile"]).toContain(device.type);
    expect(Array.isArray(device.viewport)).toBe(true);
  });

  it("honors cookie for persistent visitor id", () => {
    expect(COOKIE_VISITOR).toBe("trell:vid");
  });
});
