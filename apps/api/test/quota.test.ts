import { describe, it, expect } from "vitest";
import { EventQuota } from "../src/lib/quota";
import type { Repo } from "../src/repositories/types";

function makeRepo(counts: number[]) {
  let calls = 0;
  const repo = {
    countEventsForAnalytics: async () => counts[Math.min(calls++, counts.length - 1)],
  } as unknown as Repo;
  return { repo, calls: () => calls };
}

describe("EventQuota", () => {
  it("counts once and serves from cache within TTL", async () => {
    let now = 1_000;
    const quota = new EventQuota(30_000, () => now);
    const { repo, calls } = makeRepo([10]);

    expect(await quota.getCount(repo, "p1")).toBe(10);
    expect(await quota.getCount(repo, "p1")).toBe(10);
    expect(calls()).toBe(1);

    now += 30_001;
    const { repo: repo2, calls: calls2 } = makeRepo([12]);
    // fresh quota to isolate TTL behaviour is covered below; here cache expired:
    expect(await quota.getCount(repo2, "p1")).toBe(12);
    expect(calls2()).toBe(1);
  });

  it("trackInserted bumps the cached count without recounting", async () => {
    const quota = new EventQuota();
    const { repo, calls } = makeRepo([10]);

    expect(await quota.getCount(repo, "p1")).toBe(10);
    quota.trackInserted("p1", 3);
    expect(await quota.getCount(repo, "p1")).toBe(13);
    expect(calls()).toBe(1);
  });

  it("tracks projects independently", async () => {
    const quota = new EventQuota();
    const { repo, calls } = makeRepo([10, 20]);

    expect(await quota.getCount(repo, "p1")).toBe(10);
    expect(await quota.getCount(repo, "p2")).toBe(20);
    expect(calls()).toBe(2);
    expect(quota.size).toBe(2);
  });

});
