import type { StoredEvent } from "../repositories/types";
import { computeMetrics, type MetricsSummary } from "./metrics";
import { computeFunnel, type FunnelResult } from "./funnel";
import type { FunnelRecord } from "../repositories/types";

// ── Types ─────────────────────────────────────────────────────

export interface MetricDelta {
  absolute: number;
  /** percentage change: (compare - baseline) / baseline * 100. null if baseline is 0 or null. */
  percentage: number | null;
  direction: "up" | "down" | "flat";
}

export interface MetricsComparison {
  baseline: MetricsSummary;
  compare: MetricsSummary;
  deltas: {
    events: MetricDelta;
    views: MetricDelta;
    starts: MetricDelta;
    submits: MetricDelta;
    successes: MetricDelta;
    conversionRate: MetricDelta;
    startConversionRate: MetricDelta;
    sessions: MetricDelta;
    visitors: MetricDelta;
  };
}

export interface FunnelComparison {
  baseline: FunnelResult;
  compare: FunnelResult;
  stepDeltas: {
    position: number;
    key: string;
    label: string;
    baselineCount: number;
    compareCount: number;
    countDelta: MetricDelta;
    baselineConversion: number | null;
    compareConversion: number | null;
    conversionDelta: MetricDelta;
  }[];
}

// ── Comparison computation ────────────────────────────────────

export function computeMetricsComparison(
  baselineEvents: StoredEvent[],
  compareEvents: StoredEvent[],
): MetricsComparison {
  const baseline = computeMetrics(baselineEvents);
  const compare = computeMetrics(compareEvents);

  return {
    baseline,
    compare,
    deltas: {
      events: delta(baseline.events, compare.events),
      views: delta(baseline.views, compare.views),
      starts: delta(baseline.starts, compare.starts),
      submits: delta(baseline.submits, compare.submits),
      successes: delta(baseline.successes, compare.successes),
      conversionRate: deltaNullable(baseline.conversionRate, compare.conversionRate),
      startConversionRate: deltaNullable(baseline.startConversionRate, compare.startConversionRate),
      sessions: delta(baseline.sessions, compare.sessions),
      visitors: delta(baseline.visitors, compare.visitors),
    },
  };
}

export function computeFunnelComparison(
  baselineResult: FunnelResult,
  compareResult: FunnelResult,
): FunnelComparison {
  const maxLen = Math.max(baselineResult.steps.length, compareResult.steps.length);
  const stepDeltas: FunnelComparison["stepDeltas"] = [];

  for (let i = 0; i < maxLen; i++) {
    const bStep = baselineResult.steps[i];
    const cStep = compareResult.steps[i];
    const key = bStep?.key ?? cStep?.key ?? "unknown";
    const label = bStep?.label ?? cStep?.label ?? `Step ${i + 1}`;
    const bCount = bStep?.count ?? 0;
    const cCount = cStep?.count ?? 0;

    stepDeltas.push({
      position: i,
      key,
      label,
      baselineCount: bCount,
      compareCount: cCount,
      countDelta: delta(bCount, cCount),
      baselineConversion: bStep?.conversionFromPrevious ?? null,
      compareConversion: cStep?.conversionFromPrevious ?? null,
      conversionDelta: deltaNullable(bStep?.conversionFromPrevious ?? null, cStep?.conversionFromPrevious ?? null),
    });
  }

  return {
    baseline: baselineResult,
    compare: compareResult,
    stepDeltas,
  };
}

// ── Helpers ───────────────────────────────────────────────────

function delta(baseline: number, compare: number): MetricDelta {
  const absolute = compare - baseline;
  const percentage = baseline !== 0 ? (absolute / baseline) * 100 : null;
  const direction = absolute > 0 ? "up" : absolute < 0 ? "down" : "flat";
  return { absolute, percentage, direction };
}

function deltaNullable(baseline: number | null, compare: number | null): MetricDelta {
  if (baseline === null && compare === null) return { absolute: 0, percentage: null, direction: "flat" };
  const b = baseline ?? 0;
  const c = compare ?? 0;
  return delta(b, c);
}
