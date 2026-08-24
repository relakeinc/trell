import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/middleware/ratelimit";

describe("RateLimiter", () => {
  it("allows requests up to the limit", () => {
    const rl = new RateLimiter(3, 60_000, () => 0);
    expect(rl.check("k")).toMatchObject({ allowed: true });
    expect(rl.check("k")).toMatchObject({ allowed: true });
    expect(rl.check("k")).toMatchObject({ allowed: true });
  });

  it("denies beyond the limit with a retry-after", () => {
    const rl = new RateLimiter(2, 60_000, () => 0);
    rl.check("k");
    rl.check("k");
    const third = rl.check("k");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    let now = 0;
    const rl = new RateLimiter(1, 60_000, () => now);
    expect(rl.check("k").allowed).toBe(true);
    expect(rl.check("k").allowed).toBe(false);
    now = 61_000;
    expect(rl.check("k").allowed).toBe(true);
  });

  it("keys are independent", () => {
    const rl = new RateLimiter(1, 60_000, () => 0);
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("b").allowed).toBe(true);
  });
});
