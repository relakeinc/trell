interface Entry {
  windowStart: number;
  count: number;
}

/** Fixed-window limiter (in-memory). Redis is the future path. */
export class RateLimiter {
  private map = new Map<string, Entry>();

  constructor(
    private max: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = this.now();
    let e = this.map.get(key);
    if (!e || now - e.windowStart >= this.windowMs) {
      e = { windowStart: now, count: 0 };
      this.map.set(key, e);
    }
    e.count += 1;
    if (e.count > this.max) {
      const retryAfterMs = Math.max(1, e.windowStart + this.windowMs - now);
      return { allowed: false, remaining: 0, retryAfterMs };
    }
    return { allowed: true, remaining: this.max - e.count, retryAfterMs: 0 };
  }
}
