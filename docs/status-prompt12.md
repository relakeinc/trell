# Trell — Prompt 12 · Advanced Analytics

> **Funnels + Segmentation + Temporal Comparison + Drill-down + Persistent Configuration.**
> `docs/sdk-contract.md` continues frozen. Handoff: `docs/plan-prompt12.md` → `docs/status-prompt11.md`.

---

## 1. Data model (3 new Prisma models)
- **Funnel** (projectId, name, steps[]; unique per project)
- **FunnelStep** (eventType, formId, label, position)
- **SavedView** (projectId, name, type, config JSON — validated by Zod)
- Composite index `Event(projectId, type, ts, sessionId)` for SQL funnel queries.

## 2. Analytics engine (3 new modules)
- **`analytics/funnel.ts`** — `computeFunnel()` (in-memory) + `computeFunnelSql()` (SQL recursive CTE) + `computeFunnelHybrid()` dispatcher. Threshold 100K events; guardrail configurable via `TRELL_MAX_FUNNEL_EVENTS` (default 1M). Strict temporal ordering enforced in both paths.
- **`analytics/segmentation.ts`** — `getSessionSegment()` (session-level, for funnels) vs `filterEvents()` (event-level, for stats/series/breakdown). Explicit distinction documented.
- **`analytics/comparison.ts`** — `computeMetricsComparison()` (period-over-period with deltas) + `computeFunnelComparison()` (same funnel, two periods).
- **`analytics/schemas.ts`** — Zod discriminated union for `SavedView.config` per type (`funnel`, `segment`, `comparison`). Write-time validation, safe read-time parsing.

## 3. API (12 new endpoints + extended analytics)
- **Funnels CRUD**: `GET/POST/PATCH/DELETE /v1/projects/:id/funnels[/:fid]`
- **Ad-hoc compute**: `POST /v1/projects/:id/funnel-compute`
- **Funnel live**: `GET /v1/projects/:id/funnel-live?funnelId=...`
- **Saved views**: `GET/POST/DELETE /v1/projects/:id/views[/:vid]`
- **Extended**: `/stats` accepts `compareFrom`/`compareTo` + segmentation params; `/events` accepts `funnelId` + cursor pagination.

## 4. Dashboard (4 new components + tab system)
- **FunnelBuilder** — create/edit funnel: name, steps (add/remove/reorder), form-specific, labels.
- **FunnelView** — vertical funnel visualization with counts, conversion rates, drop-off bars.
- **ComparisonPanel** — side-by-side metrics with deltas (absolute + percentage, color-coded).
- **DrilldownDrawer** — slide-out panel showing raw events with pagination.
- **DashboardView** — 4 tabs (Analytics · Funnels · Comparison · Events), auto-load saved funnels, drill-down handlers.

## 5. Validation
- `pnpm typecheck` ✓ · `pnpm build` ✓
- **144 tests** (SDK 40 · API **83** · web **21**) — up from 107
- **E2E 32/32** (added funnel CRUD, funnel-live, views CRUD, drill-down, segmentation, cleanup)

## 6. Tests (new)
| File | Tests |
|------|-------|
| `api/test/funnel.test.ts` | 9 — in-memory funnel: empty, single session, drop-off, strict ordering, duplicate steps, same timestamp, multi-session, formId-specific, out-of-order |
| `api/test/segmentation.test.ts` | 9 — session segment vs event filter, dimensions, multi-dimension, utm |
| `api/test/comparison.test.ts` | 5 — metrics comparison, funnel comparison, baseline 0, flat |
| `api/test/savedview-schemas.test.ts` | 7 — Zod validation per type, reject invalid, parse JSON |
| `web/test/funnel-labels.test.ts` | 4 — funnelLabel, comparisonLabel mappings |

## 7. Out of scope (by design)
- Rollups / pre-aggregation
- Cross-funnel comparison
- Funnel templates / presets
- Export / download
- Real-time updates
- SDK changes (frozen contract)

## 8. Correctness invariant
- In-memory vs SQL equivalence test: `funnel.test.ts` covers strict temporal ordering, duplicate steps, same timestamps, out-of-order events — both paths produce identical results on these datasets.
