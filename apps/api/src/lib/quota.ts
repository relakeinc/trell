import type { Repo } from "../repositories/types";

/**
 * Caches per-project event counts so the plan-limit check doesn't run a full
 * COUNT query on every ingest request. The cached value is bumped by each
 * successful insert, so it stays exact until the TTL expires and forces a
 * recount. Overshoot is bounded by what fits in one TTL window (and across
 * processes, which don't share the cache).
 */
export class EventQuota {
  private cache = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private ttlMs: number = 30_000,
    private now: () => number = Date.now,
  ) {}

  async getCount(repo: Repo, projectId: string): Promise<number> {
    const hit = this.cache.get(projectId);
    const t = this.now();
    if (hit && t < hit.expiresAt) return hit.count;
    const count = await repo.countEventsForAnalytics(projectId, {});
    this.cache.set(projectId, { count, expiresAt: t + this.ttlMs });
    return count;
  }

  trackInserted(projectId: string, inserted: number): void {
    const hit = this.cache.get(projectId);
    if (hit) hit.count += inserted;
  }

  /** Test seam: entries currently cached. */
  get size(): number {
    return this.cache.size;
  }
}
