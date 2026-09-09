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

function fmtCount(v: number | null): string {
  if (v == null) return "0";
  return Number.isInteger(v) ? new Intl.NumberFormat("en").format(v) : v.toFixed(1);
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

export function ComparisonPanel({
  data,
  baselineLabel,
  compareLabel,
}: {
  data: ComparisonData;
  baselineLabel?: string;
  compareLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-trell-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-trell-ink">
            <span className="border-b border-dotted border-neutral-300 pb-0.5">Period comparison</span>
          </h3>
          {(baselineLabel || compareLabel) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              {baselineLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-neutral-300" />
                  {baselineLabel}
                </span>
              )}
              {compareLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#2563eb]" />
                  {compareLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {METRICS.map(({ key, label, format }) => {
          const b = data.baseline[key] ?? null;
          const c = data.compare[key] ?? null;
          const d = data.deltas[key];
          const bv = b ?? 0;
          const cv = c ?? 0;
          const max = Math.max(bv, cv, Number.EPSILON);
          const fmt = (v: number | null) => (format === "rate" ? fmtPct(v) : fmtCount(v));
          const up = d?.direction === "up";
          const down = d?.direction === "down";
          const pctStr =
            d && d.percentage != null
              ? `${d.percentage > 0 ? "+" : ""}${d.percentage.toFixed(1)}%`
              : null;
          return (
            <div key={key} className="group" title={`${label}: ${fmt(b)} → ${fmt(c)}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] text-neutral-600">{label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-[13px] tabular-nums text-neutral-400">{fmt(b)}</span>
                  <span className="text-[13px] font-bold tabular-nums text-trell-ink">{fmt(c)}</span>
                  {d ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                        up ? "bg-green-50 text-green-700" : down ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {up ? "↗" : down ? "↘" : "→"}
                      {pctStr ? ` ${pctStr}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">–</span>
                  )}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-r-full bg-transparent">
                  <div
                    className="h-full rounded-l-none rounded-r-full bg-neutral-300 transition-all duration-500"
                    style={{ width: `${Math.max(bv > 0 ? 2 : 0, (bv / max) * 100)}%` }}
                  />
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-r-full bg-transparent">
                  <div
                    className="h-full rounded-l-none rounded-r-full transition-all duration-500 group-hover:brightness-110"
                    style={{ width: `${Math.max(cv > 0 ? 2 : 0, (cv / max) * 100)}%`, background: "#2563eb" }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
