import type { PrismaClient } from "@prisma/client";
import type { AnalyticsFilter, FunnelRecord, StoredEvent } from "../repositories/types";

// ── Types ─────────────────────────────────────────────────────

export interface FunnelStepResult {
  position: number;
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null; // count / previous step count
  dropOff: number | null;                // (previous - current) / previous
}

export interface FunnelResult {
  totalSessions: number;
  steps: FunnelStepResult[];
}

export const FUNNEL_THRESHOLD = 100_000;
export const FUNNEL_MAX_EVENTS = Number(process.env.TRELL_MAX_FUNNEL_EVENTS ?? 1_000_000);

// ── In-memory computation ─────────────────────────────────────

export function computeFunnel(events: StoredEvent[], steps: FunnelRecord["steps"]): FunnelResult {
  const sorted = [...steps].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return { totalSessions: 0, steps: [] };

  // Group events by session, ordered by timestamp
  const sessionEvents = new Map<string, StoredEvent[]>();
  for (const e of events) {
    let list = sessionEvents.get(e.sessionId);
    if (!list) {
      list = [];
      sessionEvents.set(e.sessionId, list);
    }
    list.push(e);
  }
  // Sort each session's events by ts
  for (const list of sessionEvents.values()) {
    list.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  }

  // For each session, walk the funnel steps in order
  const stepCounts: number[] = new Array(sorted.length).fill(0);

  for (const sessionEvts of sessionEvents.values()) {
    let prevTs = -Infinity;
    for (let si = 0; si < sorted.length; si++) {
      const step = sorted[si]!;
      const match = sessionEvts.find(
        (e) =>
          e.ts.getTime() > prevTs &&
          stepMatches(e, step.eventType, step.formId),
      );
      if (!match) break; // session dropped
      stepCounts[si]!++;
      prevTs = match.ts.getTime();
    }
  }

  const totalSessions = sessionEvents.size;
  const result: FunnelStepResult[] = sorted.map((step, i) => {
    const count = stepCounts[i] ?? 0;
    const prevCount = i === 0 ? totalSessions : (stepCounts[i - 1] ?? 0);
    return {
      position: step.position,
      key: step.eventType ?? "unknown",
      label: step.label ?? step.eventType ?? `Step ${step.position + 1}`,
      count,
      conversionFromPrevious: prevCount > 0 ? count / prevCount : null,
      dropOff: prevCount > 0 ? (prevCount - count) / prevCount : null,
    };
  });

  return { totalSessions, steps: result };
}

// ── SQL computation (recursive CTE) ───────────────────────────
// Must produce EXACTLY the same result as in-memory path.

export async function computeFunnelSql(
  prisma: PrismaClient,
  projectId: string,
  funnel: FunnelRecord,
  filter: AnalyticsFilter,
): Promise<FunnelResult> {
  const sorted = [...funnel.steps].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return { totalSessions: 0, steps: [] };

  const params: unknown[] = [projectId, funnel.id];
  let paramIdx = 3; // $1 = projectId, $2 = funnelId

  // Build step VALUES list for the CTE
  const stepValues = sorted
    .map((s) => {
      const eventTypeParam = `$${paramIdx++}`;
      const formIdParam = `$${paramIdx++}`;
      const posParam = `$${paramIdx++}`;
      params.push(s.eventType ?? null, s.formId ?? null, s.position);
      return `(${eventTypeParam}, ${formIdParam}, ${posParam})`;
    })
    .join(", ");

  // Build date filter
  let dateFilter = "";
  if (filter.from) {
    dateFilter += ` AND e.ts >= $${paramIdx++}`;
    params.push(filter.from);
  }
  if (filter.to) {
    dateFilter += ` AND e.ts <= $${paramIdx++}`;
    params.push(filter.to);
  }

  const sql = `
WITH RECURSIVE
steps_def(event_type, form_id, position) AS (
  VALUES ${stepValues}
),
-- Base: first matching event for step 0 per session
base_step AS (
  SELECT DISTINCT ON (e.session_id)
    e.session_id,
    0 AS step_idx,
    e.ts AS step_ts
  FROM "Event" e
  JOIN steps_def sd ON sd.position = 0
    AND e.type = sd.event_type
    AND (sd.form_id IS NULL OR e.form_id = sd.form_id)
  WHERE e.project_id = $1
    ${dateFilter}
  ORDER BY e.session_id, e.ts ASC
),
-- Recursive: walk subsequent steps, enforcing strict temporal ordering
recurse AS (
  SELECT * FROM base_step
  UNION ALL
  SELECT DISTINCT ON (r.session_id)
    r.session_id,
    r.step_idx + 1,
    e.ts
  FROM recurse r
  JOIN steps_def sd ON sd.position = r.step_idx + 1
  JOIN "Event" e ON e.project_id = $1
    AND e.type = sd.event_type
    AND (sd.form_id IS NULL OR e.form_id = sd.form_id)
    AND e.ts > r.step_ts
    ${dateFilter}
  WHERE r.step_idx + 1 < ${sorted.length}
  ORDER BY r.session_id, e.ts ASC
)
SELECT step_idx, COUNT(DISTINCT session_id) AS session_count
FROM recurse
GROUP BY step_idx
ORDER BY step_idx;
`;

  const rows: { step_idx: number; session_count: bigint }[] = await prisma.$queryRawUnsafe(sql, ...params);

  // Total sessions: count distinct session_ids in the date range (all events, not just funnel)
  const totalSessions = await countDistinctSessions(prisma, projectId, filter);

  // Build result matching in-memory output format
  const countMap = new Map<number, number>();
  for (const row of rows) {
    countMap.set(row.step_idx, Number(row.session_count));
  }

  const result: FunnelStepResult[] = sorted.map((step, i) => {
    const count = countMap.get(i) ?? 0;
    const prevCount = i === 0 ? totalSessions : (countMap.get(i - 1) ?? 0);
    return {
      position: step.position,
      key: step.eventType ?? "unknown",
      label: step.label ?? step.eventType ?? `Step ${step.position + 1}`,
      count,
      conversionFromPrevious: prevCount > 0 ? count / prevCount : null,
      dropOff: prevCount > 0 ? (prevCount - count) / prevCount : null,
    };
  });

  return { totalSessions, steps: result };
}

// ── Hybrid dispatcher ─────────────────────────────────────────

export async function computeFunnelHybrid(
  prisma: PrismaClient | null,
  projectId: string,
  funnel: FunnelRecord,
  events: StoredEvent[],
  filter: AnalyticsFilter,
): Promise<FunnelResult> {
  const count = events.length;
  if (count <= FUNNEL_THRESHOLD || !prisma) {
    return computeFunnel(events, funnel.steps);
  }
  if (count > FUNNEL_MAX_EVENTS) {
    throw new FunnelTooLargeError(count, FUNNEL_MAX_EVENTS);
  }
  return computeFunnelSql(prisma, projectId, funnel, filter);
}

// ── Helpers ───────────────────────────────────────────────────

function stepMatches(e: StoredEvent, eventType: string | null, formId: string | null): boolean {
  if (eventType && e.type !== eventType) return false;
  if (formId && e.formId !== formId) return false;
  return true;
}

async function countDistinctSessions(
  prisma: PrismaClient,
  projectId: string,
  filter: AnalyticsFilter,
): Promise<number> {
  const params: unknown[] = [projectId];
  let paramIdx = 2;
  let where = `WHERE project_id = $1`;
  if (filter.from) {
    where += ` AND ts >= $${paramIdx++}`;
    params.push(filter.from);
  }
  if (filter.to) {
    where += ` AND ts <= $${paramIdx++}`;
    params.push(filter.to);
  }
  const rows: { count: bigint }[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT session_id) AS count FROM "Event" ${where}`,
    ...params,
  );
  return Number(rows[0]?.count ?? 0n);
}

// ── Errors ────────────────────────────────────────────────────

export class FunnelTooLargeError extends Error {
  constructor(
    public readonly eventCount: number,
    public readonly limit: number,
  ) {
    super(
      `Funnel computation requires ${eventCount} events, exceeding limit of ${limit}. Try a narrower date range.`,
    );
    this.name = "FunnelTooLargeError";
  }
}
