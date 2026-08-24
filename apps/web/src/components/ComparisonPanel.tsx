"use client";

interface MetricDelta {
  absolute: number;
  percentage: number | null;
  direction: "up" | "down" | "flat";
}

interface ComparisonData {
  baseline: Record<string, number | null>;
  compare: Record<string, number | null>;
  deltas: Record<string, MetricDelta>;
}

function fmtPct(x: number | null): string {
  return x == null ? "–" : (x * 100).toFixed(1) + "%";
}

function fmtDelta(d: MetricDelta): { text: string; color: string } {
  if (d.direction === "flat") return { text: "0", color: "text-trell-ink-muted" };
  const sign = d.absolute > 0 ? "+" : "";
  const abs = typeof d.absolute === "number" && d.absolute % 1 !== 0
    ? d.absolute.toFixed(1)
    : String(d.absolute);
  const pctStr = d.percentage != null ? ` (${d.percentage > 0 ? "+" : ""}${d.percentage.toFixed(1)}%)` : "";
  return {
    text: `${sign}${abs}${pctStr}`,
    color: d.direction === "up" ? "text-green-600" : "text-red-600",
  };
}

const METRICS = [
  { key: "events", label: "Events", format: "number" as const },
  { key: "views", label: "Form views", format: "number" as const },
  { key: "starts", label: "Form starts", format: "number" as const },
  { key: "submits", label: "Submissions", format: "number" as const },
  { key: "successes", label: "Conversions", format: "number" as const },
  { key: "conversionRate", label: "Conversion rate", format: "rate" as const },
  { key: "startConversionRate", label: "Completion after start", format: "rate" as const },
  { key: "sessions", label: "Sessions", format: "number" as const },
  { key: "visitors", label: "Visitors", format: "number" as const },
];

export function ComparisonPanel({ data }: { data: ComparisonData }) {
  return (
    <div className="trell-card p-4">
      <div className="mb-3 grid grid-cols-4 gap-2 text-xs text-trell-ink-muted">
        <div></div>
        <div className="text-right">Previous</div>
        <div className="text-right">Current</div>
        <div className="text-right">Change</div>
      </div>
      <div className="space-y-0">
        {METRICS.map(({ key, label, format }) => {
          const b = data.baseline[key] ?? null;
          const c = data.compare[key] ?? null;
          const d = data.deltas[key];
          const fmt = (v: number | null) => format === "rate" ? fmtPct(v) : String(v ?? 0);
          const delta = d ? fmtDelta(d) : { text: "–", color: "text-trell-ink-muted" };
          return (
            <div key={key} className="grid grid-cols-4 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">
              <span className="text-trell-ink-subtle">{label}</span>
              <span className="text-right tabular-nums text-trell-ink-default">{fmt(b)}</span>
              <span className="text-right tabular-nums text-trell-ink-default">{fmt(c)}</span>
              <span className={`text-right tabular-nums font-medium ${delta.color}`}>{delta.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
