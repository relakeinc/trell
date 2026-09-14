import { monitorEventLoopDelay } from "node:perf_hooks";

// Cumulative event-loop delay histogram — Node's equivalent of Tokio's
// schedule-latency metric. Sampled by the runtime itself, so reading it is
// cheap. If p99 stays in single-digit ms, the loop is healthy; sustained
// tens of ms means synchronous work (e.g. big analytics computations) is
// stealing time from latency-sensitive routes like ingest.
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

const NS_TO_MS = 1_000_000;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function eventLoopLagMs(): { p50: number; p99: number; max: number } {
  return {
    p50: round3(histogram.percentile(50) / NS_TO_MS),
    p99: round3(histogram.percentile(99) / NS_TO_MS),
    max: round3(histogram.max / NS_TO_MS),
  };
}
