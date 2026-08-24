# Trell — Prompt 12 · Advanced Analytics (Plan)

> **Funnels + Segmentation + Temporal Comparison + Drill-down + Persistent Configuration.**
> `docs/sdk-contract.md` continues frozen.

---

## 0. Rationale

The core SDK → API → Analytics → Dashboard pipeline is solid. Before adding external integrations (Slack/Jira/Notion), the **analysis layer** must have enough depth to be valuable. This prompt adds:

- **Funnels** — configurable step-by-step conversion analysis
- **Segmentation** — filter any metric by page/form/device/browser/OS/UTM
- **Temporal comparison** — period-over-period delta (e.g., Aug 16–22 vs Aug 9–15)
- **Drill-down** — from a metric number → underlying raw events
- **Persistent configuration** — funnels/saved views stored per project in DB, not localStorage

No rollups introduced. All analytics computed on-the-fly (in-memory for small ranges, SQL for large).

---

## 1. Data Model Changes

### New Prisma models

```
Funnel
  id              UUID (PK)
  projectId       UUID (FK → Project)
  name            String
  steps           FunnelStep[] (relation)
  createdAt       DateTime
  updatedAt       DateTime
  @@unique([projectId, name])

FunnelStep
  id              UUID (PK)
  funnelId        UUID (FK → Funnel, onDelete: Cascade)
  funnel          Funnel (relation)
  eventType       String?     -- e.g. "form_view", "form_start", "cta_click"
  formId          String?     -- optional: specific form (null = any form)
  label           String?     -- optional display label (auto-generated if null)
  position        Int         -- ordering (0-based)

SavedView
  id              UUID (PK)
  projectId       UUID (FK → Project)
  name            String
  type            String      -- "funnel" | "segment" | "comparison"
  config          String (JSON) -- validated by Zod schema per type (see §2)
  createdAt       DateTime
  updatedAt       DateTime
```

### Migration
- `prisma migrate dev --name add-funnels-saved-views`
- Add composite index on `Event(projectId, type, ts, sessionId)` for funnel SQL queries

### Design decisions
- `FunnelStep.eventType` + optional `formId` allows both generic (all form_view) and form-specific (form_view for form "checkout") steps
- `position` field for explicit ordering (not array index — safer for reordering)
- `SavedView.config` validated by Zod schema per type (see §2) — never arbitrary JSON
- Funnel names unique per project (allows "Main funnel", "Checkout funnel", etc.)

---

## 2. Analytics Engine (New Module)

### New files
- `apps/api/src/analytics/funnel.ts` — funnel computation
- `apps/api/src/analytics/segmentation.ts` — segmentation filters
- `apps/api/src/analytics/comparison.ts` — period-over-period
- `apps/api/src/analytics/schemas.ts` — Zod schemas for SavedView config per type

### SavedView config schemas (Zod)

Each `type` has a dedicated Zod schema. `SavedView.config` is validated at write time:

```typescript
// apps/api/src/analytics/schemas.ts
import { z } from "zod";

const FunnelViewConfigSchema = z.object({
  funnelId: z.string().uuid(),
  segment: z.record(z.string()).optional(), // dimension filters
});

const SegmentViewConfigSchema = z.object({
  dimension: z.string(),         // page, device, browser, etc.
  segment: z.record(z.string()), // filter values
  metric: z.string().optional(), // which metric to show
});

const ComparisonViewConfigSchema = z.object({
  baselineFrom: z.string(),      // ISO datetime
  baselineTo: z.string(),
  compareFrom: z.string(),
  compareTo: z.string(),
  segment: z.record(z.string()).optional(),
  funnelId: z.string().uuid().optional(), // compare funnel across periods
});

export const SavedViewConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("funnel"), ...FunnelViewConfigSchema.shape }),
  z.object({ type: z.literal("segment"), ...SegmentViewConfigSchema.shape }),
  z.object({ type: z.literal("comparison"), ...ComparisonViewConfigSchema.shape }),
]);

export type FunnelViewConfig = z.infer<typeof FunnelViewConfigSchema>;
export type SegmentViewConfig = z.infer<typeof SegmentViewConfigSchema>;
export type ComparisonViewConfig = z.infer<typeof ComparisonViewConfigSchema>;
```

At write time: `SavedViewConfigSchema.parse({ type, config })` — rejects invalid configs.
At read time: `SavedViewConfigSchema.parse({ type, config: JSON.parse(config) })` — safe cast.

### Hybrid computation strategy

1. Query `Event.count({ where: { projectId, ts: { gte: from, lte: to } } })`
2. If count ≤ `FUNNEL_THRESHOLD` (100K): load all events → compute in JS (current pattern)
3. If count > `FUNNEL_THRESHOLD`: use SQL sequential evaluation (see below)
4. If count > `FUNNEL_MAX_EVENTS` (configurable, default 1M): return error suggesting narrower date range

`FUNNEL_MAX_EVENTS` is a **configurable guardrail** (env var `TRELL_MAX_FUNNEL_EVENTS`), not a conceptual limit of the SQL engine. The SQL path can handle more; this guard prevents accidental resource exhaustion.

### Funnel computation (in-memory path)

```
Input: events[], steps[] (ordered by position)
For each session (grouped by sessionId, ordered by ts):
  prevTs = -Infinity
  For each step in order:
    Find first event matching step.eventType (+ optional formId)
    where event.ts > prevTs
    If found: record step reached, set prevTs = event.ts
    If not found: session dropped at this step, stop
Output: { steps: [{ key, label, count, conversionFromPrevious, dropOff }], totalSessions }
```

### Funnel computation (SQL path — strict temporal ordering)

**The SQL must produce exactly the same result as the in-memory path.** The key invariant: step N+1 must occur strictly after step N within the same session.

```sql
-- Sequential evaluation: for each session, walk the funnel steps in order.
-- A session "reaches" step K only if it has a matching event for step K
-- that occurs AFTER the event for step K-1.
WITH RECURSIVE session_steps AS (
  -- Base: for each session, find the first event matching step 0
  SELECT
    e.session_id,
    0 AS step_idx,
    e.ts AS step_ts
  FROM "FunnelStep" fs
  JOIN "Event" e ON e.project_id = :projectId
    AND e.type = fs.event_type
    AND e.ts BETWEEN :from AND :to
    AND (fs.form_id IS NULL OR e.form_id = fs.form_id)
  WHERE fs.funnel_id = :funnelId AND fs.position = 0
  GROUP BY e.session_id, e.ts

  UNION ALL

  -- Recursive: for each session that reached step K,
  -- find the first event matching step K+1 AFTER step K's timestamp
  SELECT
    ss.session_id,
    ss.step_idx + 1,
    MIN(e.ts)
  FROM session_steps ss
  JOIN "FunnelStep" fs ON fs.funnel_id = :funnelId AND fs.position = ss.step_idx + 1
  JOIN "Event" e ON e.project_id = :projectId
    AND e.type = fs.event_type
    AND e.ts > ss.step_ts          -- STRICT ORDER: must be after previous step
    AND e.ts BETWEEN :from AND :to
    AND (fs.form_id IS NULL OR e.form_id = fs.form_id)
  GROUP BY ss.session_id, ss.step_idx + 1
),
-- Count distinct sessions reaching each step
step_counts AS (
  SELECT step_idx, COUNT(DISTINCT session_id) AS session_count
  FROM session_steps
  GROUP BY step_idx
)
SELECT step_idx, session_count
FROM step_counts
ORDER BY step_idx;
```

Then compute conversion/drop-off rates from step counts in JS (identical to in-memory path).

**If the recursive CTE is too slow for very large datasets**, fall back to a simpler approach: load events for the project+range into a temp table, then use a window function to find per-session first-match timestamps per step, then walk sequentially in JS. The recursive CTE is the primary path; the fallback is an optimization concern, not a semantic difference.

### Segmentation semantics

**Two distinct concepts — not interchangeable:**

#### Event filter
A condition that individual events must satisfy. Used for:
- Breakdown (group events by dimension)
- Series (time-series with event-level grouping)
- Stats (aggregate counts over filtered events)
- Drill-down (show events matching criteria)

Applied as `WHERE` clauses on the Event query before any computation.

#### Session segment (for funnels)
A condition on the **session as a whole**, not on individual events. Used for:
- Funnels (which sessions to include in the funnel analysis)

The semantics: "include sessions that contain at least one event matching the segment." This avoids the misleading result where filtering events before the funnel causes step drops.

**Example:**
```
Session 123:
  form_view     page=/landing    10:00
  form_start    page=/checkout   10:05
  form_success  page=/checkout   10:20

Filter: page=/landing
```

- **Event filter**: only `form_view` matches → funnel sees step 1 only → appears as abandonment
- **Session segment**: session 123 contains an event with `page=/landing` → session is included → all 3 steps visible

**For Prompt 12:** implement **session segment** for funnels (the useful behavior). Event filter is already implicit in breakdown/series/stats. Document the distinction clearly.

#### Implementation

```typescript
// Session segment: find qualifying session IDs first, then filter events
async function getSessionSegment(projectId, segment, from, to): Promise<Set<string>> {
  // SELECT DISTINCT session_id FROM Event
  // WHERE projectId AND ts BETWEEN from AND to
  //   AND (page = :page OR device = :device OR ...)
  return new Set(qualifyingSessionIds);
}

// Then for funnel computation:
// events.filter(e => qualifyingSessions.has(e.sessionId))
```

### Temporal comparison
- Two date ranges: `baseline` (e.g., Aug 9–15) and `compare` (e.g., Aug 16–22)
- Compute same metrics/funnel for both ranges
- Output: `{ baseline: Metrics, compare: Metrics, delta: { absolute, percentage } }`
- Backend: single endpoint accepts `compareFrom`/`compareTo` params
- Frontend: makes one request, renders side-by-side

---

## 3. API Changes

### New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/projects/:id/funnels` | List saved funnels |
| `POST` | `/v1/projects/:id/funnels` | Create funnel |
| `GET` | `/v1/projects/:id/funnels/:fid` | Get funnel + live metrics |
| `PATCH` | `/v1/projects/:id/funnels/:fid` | Update funnel (name, steps) |
| `DELETE` | `/v1/projects/:id/funnels/:fid` | Delete funnel |
| `GET` | `/v1/projects/:id/funnel-compute` | Compute arbitrary funnel (ad-hoc, not saved) |
| `GET` | `/v1/projects/:id/views` | List saved views |
| `POST` | `/v1/projects/:id/views` | Save a view (config validated by Zod) |
| `DELETE` | `/v1/projects/:id/views/:vid` | Delete saved view |

### Extended endpoints

| Endpoint | New params |
|----------|-----------|
| `GET /stats` | `compareFrom`, `compareTo`, `page`, `device`, `browser`, `os`, `utmSource`, `utmMedium`, `utmCampaign` |
| `GET /series` | Same segmentation params |
| `GET /breakdown` | Same segmentation params |
| `GET /events` | `page`, `device`, `browser`, `os`, `utmSource`, `utmMedium`, `utmCampaign`, `funnelId` (for funnel drill-down), `cursor` (pagination) |

### Error responses
- `400` — invalid funnel steps (e.g., unknown event type), invalid date range, invalid SavedView config
- `413` — event count exceeds `FUNNEL_MAX_EVENTS`, suggest narrower range
- `404` — funnel/view not found

---

## 4. Dashboard Changes

### New components
- `FunnelBuilder.tsx` — create/edit funnel: name, steps (add/remove/reorder), segment filters, date range, save
- `FunnelView.tsx` — render funnel: vertical steps with counts, conversion rates, drop-off bars
- `ComparisonPanel.tsx` — side-by-side metrics with delta (absolute + percentage, color-coded green/red)
- `DrilldownDrawer.tsx` — slide-out panel showing raw events for a specific metric/funnel step

### Modified components
- `DashboardView.tsx` — integrate funnel tab, comparison mode, saved views, drill-down click handlers
- `ProjectSettings.tsx` — no changes needed (funnels are in dashboard, not settings)

### Dashboard new tabs
Current tabs: Analytics · Events
New tabs: **Analytics** · **Funnels** · **Comparison** · **Events**

### Funnels tab UX
1. **Saved funnels list** (auto-loaded on mount): shows saved funnels with name + summary (e.g., "4 steps · 25% conversion")
2. Click a saved funnel → loads FunnelView with live metrics
3. **"New funnel"** button → opens FunnelBuilder
4. FunnelView has "Save" / "Save as" buttons for persistence
5. **Drill-down**: click any step count → opens DrilldownDrawer with filtered events

### Comparison tab UX
1. Select baseline range (default: previous period)
2. Select compare range (default: current period)
3. Side-by-side KPI cards with deltas
4. Can also compare funnels (same funnel, two periods)

### Auto-load on mount
- `DashboardView` fetches `/funnels` and `/views` on project change
- Saved funnels appear in Funnels tab list
- Last-used view type (funnel/comparison/analytics) persisted in URL hash or localStorage (UI preference only — data is in DB)

---

## 5. File-by-file plan

### Database
| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `Funnel`, `FunnelStep`, `SavedView` models |
| `apps/api/prisma/migrations/...` | New migration |

### Analytics engine
| File | Action |
|------|--------|
| `apps/api/src/analytics/schemas.ts` | **NEW** — Zod schemas for SavedView config per type |
| `apps/api/src/analytics/funnel.ts` | **NEW** — `computeFunnel()` (in-memory), `computeFunnelSql()` (SQL recursive CTE), `FunnelResult` type |
| `apps/api/src/analytics/segmentation.ts` | **NEW** — `getSessionSegment()`, `buildEventFilter()`, segment vs filter distinction |
| `apps/api/src/analytics/comparison.ts` | **NEW** — `computeComparison()`, `ComparisonResult` type |
| `apps/api/src/analytics/metrics.ts` | **EXTEND** — accept segmentation filters, add comparison-aware wrapper |

### Repository
| File | Action |
|------|--------|
| `apps/api/src/repositories/types.ts` | **EXTEND** — add funnel/view CRUD methods, `FunnelRecord`, `SavedViewRecord` types, extended `AnalyticsFilter` with segment fields |
| `apps/api/src/repositories/prisma.ts` | **EXTEND** — implement new methods |
| `apps/api/src/repositories/inmemory.ts` | **EXTEND** — implement new methods (for tests) |

### API routes
| File | Action |
|------|--------|
| `apps/api/src/routes/analytics.ts` | **EXTEND** — add segmentation params to stats/series/breakdown, comparison to stats, funnel drill-down to events |
| `apps/api/src/routes/funnels.ts` | **NEW** — CRUD for funnels + ad-hoc computation |
| `apps/api/src/routes/views.ts` | **NEW** — CRUD for saved views (config validated by Zod) |
| `apps/api/src/app.ts` | **EXTEND** — register new routes |

### Web (Next.js)
| File | Action |
|------|--------|
| `apps/web/src/lib/apiClient.ts` | **EXTEND** — add `funnels()`, `views()` helper methods |
| `apps/web/src/app/api/projects/[id]/funnels/route.ts` | **NEW** — proxy to API |
| `apps/web/src/app/api/projects/[id]/funnels/[fid]/route.ts` | **NEW** — proxy to API |
| `apps/web/src/app/api/projects/[id]/views/route.ts` | **NEW** — proxy to API |
| `apps/web/src/components/FunnelBuilder.tsx` | **NEW** — create/edit funnel UI |
| `apps/web/src/components/FunnelView.tsx` | **NEW** — funnel visualization |
| `apps/web/src/components/ComparisonPanel.tsx` | **NEW** — period comparison UI |
| `apps/web/src/components/DrilldownDrawer.tsx` | **NEW** — raw events drill-down |
| `apps/web/src/components/DashboardView.tsx` | **EXTEND** — add Funnels/Comparison tabs, integrate new components, auto-load saved funnels |
| `apps/web/src/lib/labels.ts` | **EXTEND** — add funnel/comparison labels |

### Tests
| File | Action |
|------|--------|
| `apps/api/test/funnel.test.ts` | **NEW** — funnel computation unit tests |
| `apps/api/test/funnel-equivalence.test.ts` | **NEW** — **in-memory vs SQL equivalence tests** (same datasets, identical results) |
| `apps/api/test/segmentation.test.ts` | **NEW** — session segment vs event filter tests |
| `apps/api/test/comparison.test.ts` | **NEW** — comparison computation tests |
| `apps/api/test/savedview-schemas.test.ts` | **NEW** — SavedView config Zod validation tests |
| `apps/api/test/funnels-api.test.ts` | **NEW** — funnel CRUD API tests |
| `apps/web/test/funnel-labels.test.ts` | **NEW** — funnel-related label tests |

### Docs
| File | Action |
|------|--------|
| `docs/status-prompt12.md` | **NEW** — implementation status |
| `docs/sdk-contract.md` | **UNCHANGED** (frozen) |

---

## 6. Implementation sequence

| Phase | Files | Dependency |
|-------|-------|-----------|
| 1. Schema + migration | `schema.prisma` | None |
| 2. SavedView Zod schemas | `analytics/schemas.ts` | None |
| 3. Repository types | `repositories/types.ts` | Phase 1 |
| 4. Repository impl | `repositories/prisma.ts`, `inmemory.ts` | Phase 3 |
| 5. Analytics engine | `analytics/funnel.ts`, `segmentation.ts`, `comparison.ts` | Phase 3 |
| 6. API routes | `routes/funnels.ts`, `routes/views.ts`, `routes/analytics.ts` (extend) | Phases 4–5 |
| 7. App wiring | `app.ts` | Phase 6 |
| 8. Web proxy routes | `api/projects/[id]/funnels/`, `views/` | Phase 6 |
| 9. Web components | `FunnelBuilder`, `FunnelView`, `ComparisonPanel`, `DrilldownDrawer` | Phase 8 |
| 10. Dashboard integration | `DashboardView.tsx` extend | Phase 9 |
| 11. Labels | `labels.ts` extend | Phase 9 |
| 12. Tests | all test files | Phases 3–7 |
| 13. **Equivalence tests** | `funnel-equivalence.test.ts` | Phases 4–5 (both paths implemented) |
| 14. E2E extension | `scripts/e2e.ts` | All phases |

---

## 7. Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rollups | None (on-the-fly only) | Per user request — measure real performance first |
| Hybrid threshold | 100K events | Safe for in-memory; SQL path for larger |
| Max events guardrail | Configurable (`TRELL_MAX_FUNNEL_EVENTS`, default 1M) | Operational limit, not conceptual SQL limit |
| SQL funnel ordering | Recursive CTE with `e.ts > ss.step_ts` | Strictly enforces step ordering; same semantics as in-memory |
| Funnel naming | Unique per project | Avoids ambiguity; allows "Main funnel" per project |
| Comparison | Backend computes both periods | Avoids race conditions between two frontend requests |
| Drill-down | Extend /events | Simpler than new endpoint; reuses existing filter logic |
| Saved views config | Zod discriminated union per type | Prevents invalid configs; type-safe at read/write time |
| Segmentation for funnels | **Session segment** (session contains matching event) | Avoids misleading drop-offs from event-level filtering |
| Segmentation for stats/series | **Event filter** (standard WHERE) | Correct for aggregate metrics |
| Reordering funnel steps | Explicit position field | Safer than array index for concurrent edits |
| **Equivalence testing** | Mandatory in-memory vs SQL comparison tests | Semantic bugs > performance bugs; both paths must produce identical results |

---

## 8. Out of scope (by design)

- Rollups / pre-aggregation (DailyStats, HourlyStats)
- Cross-funnel comparison (compare funnel A vs funnel B)
- Funnel templates / presets
- Export / download
- Funnel sharing across projects
- Real-time funnel updates (polling is fine for MVP)
- SQL window function optimization (recursive CTE is primary; optimization is future work)

---

## 9. Expected test count after Prompt 12

| Package | Current | After P12 | Delta |
|---------|---------|-----------|-------|
| SDK | 40 | 40 | — |
| API | 50 | ~75 | +~25 (funnel, equivalence, segmentation, comparison, schemas, CRUD) |
| Web | 17 | ~22 | +~5 (funnel labels, saved views) |
| **Total** | **107** | **~137** | **+~30** |

---

## 10. Migration path from P11

1. `prisma migrate dev --name add-funnels-saved-views` creates new tables
2. No changes to existing Event table or indexes (new composite index added for funnel SQL)
3. All existing endpoints remain backward-compatible (new params are optional)
4. Dashboard adds new tabs without removing existing Analytics/Events tabs
5. No SDK changes (frozen contract)

---

## 11. Correctness invariant (non-negotiable)

> **The in-memory funnel path and the SQL funnel path must produce identical results on the same dataset.**

This is tested by `funnel-equivalence.test.ts`: generate synthetic sessions with known step sequences, compute via both paths, assert deep equality on step counts, conversion rates, and drop-off rates.

If the paths diverge, it is a **semantic bug**, not a performance issue. The failing path is fixed before merge.
