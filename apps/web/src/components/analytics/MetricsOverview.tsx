"use client";

export interface OverviewMetrics {
  views: number;
  starts: number;
  submits: number;
  successes: number;
  abandons: number;
  fieldInteractions: number;
  conversionRate: number | null;
  startConversionRate: number | null;
}

interface MetricsOverviewProps {
  metrics: OverviewMetrics;
  prev: OverviewMetrics | null;
  rangeLabel: string;
}

const fmtInt = new Intl.NumberFormat("en");

/** Ratio (0–1) → "12.3%" or "—" when null. */
function fmtRate(x: number | null): string {
  if (x == null) return "—";
  return (x * 100).toFixed(x >= 0.1 ? 1 : 2) + "%";
}

type Trend = { text: string; good: boolean | null };

/**
 * Relative change of `cur` vs `base` as "↑/↓ X.X%".
 * Returns "—" when there is no previous period or the base is 0
 * (a percentage change would be invented). `invert` flips the
 * good/bad reading (e.g. fewer abandons is good).
 */
function trend(cur: number | null, base: number | null | undefined, invert = false): Trend {
  if (cur == null || base == null || base === 0) return { text: "—", good: null };
  const diff = cur - base;
  if (diff === 0) return { text: "→ 0.0%", good: null };
  const pctChange = Math.abs((diff / base) * 100).toFixed(1);
  const improved = invert ? diff < 0 : diff > 0;
  return { text: `${diff > 0 ? "↑" : "↓"} ${pctChange}%`, good: improved };
}

function TrendBadge({ t }: { t: Trend }) {
  const cls =
    t.good == null
      ? "text-neutral-400 dark:text-neutral-500"
      : t.good
        ? "text-green-600 dark:text-green-500"
        : "text-red-500 dark:text-red-400";
  return <span className={`text-xs font-medium tabular-nums ${cls}`}>{t.text}</span>;
}

function MiniMetric({
  label,
  dot,
  value,
  large,
  t,
}: {
  label: string;
  dot: string;
  value: string;
  large?: boolean;
  t: Trend;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[13px] text-neutral-600 dark:text-neutral-400">
        <span className={`h-2 w-2 shrink-0 rounded-sm ${dot}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span
          className={`tabular-nums text-trell-ink ${
            large ? "text-3xl font-semibold leading-9 sm:text-4xl" : "text-2xl font-semibold leading-8"
          }`}
        >
          {value}
        </span>
        <TrendBadge t={t} />
      </div>
    </div>
  );
}

export function MetricsOverview({ metrics, prev, rangeLabel }: MetricsOverviewProps) {
  const funnelMax = Math.max(
    1,
    metrics.views,
    metrics.starts,
    metrics.fieldInteractions,
    metrics.submits,
    metrics.successes,
    metrics.abandons,
  );

  const funnel: { label: string; value: number; bar: string }[] = [
    { label: "Views", value: metrics.views, bar: "bg-blue-500" },
    { label: "Starts", value: metrics.starts, bar: "bg-indigo-500" },
    { label: "Interactions", value: metrics.fieldInteractions, bar: "bg-purple-500" },
    { label: "Submits", value: metrics.submits, bar: "bg-teal-600" },
    { label: "Success", value: metrics.successes, bar: "bg-green-600" },
    { label: "Abandoned", value: metrics.abandons, bar: "bg-orange-500" },
  ];

  const viewToSubmit = metrics.views > 0 ? metrics.successes / metrics.views : null;

  return (
    <section className="overflow-hidden rounded-xl border border-trell-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-trell-line px-4 py-3 sm:px-6">
        <h2 className="text-sm font-medium text-trell-ink">Overview</h2>
        <span className="text-xs text-trell-ink-muted">{rangeLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 py-4 sm:px-6 lg:grid-cols-4">
        <MiniMetric
          label="Starts"
          dot="bg-blue-500"
          value={fmtInt.format(metrics.starts)}
          t={trend(metrics.starts, prev?.starts)}
        />
        <MiniMetric
          label="Submits"
          dot="bg-teal-600"
          value={fmtInt.format(metrics.submits)}
          t={trend(metrics.submits, prev?.submits)}
        />
        <MiniMetric
          label="Abandons"
          dot="bg-orange-500"
          value={fmtInt.format(metrics.abandons)}
          t={trend(metrics.abandons, prev?.abandons, true)}
        />
        <MiniMetric
          label="Completion"
          dot="bg-green-600"
          value={fmtRate(metrics.startConversionRate)}
          large
          t={trend(metrics.startConversionRate, prev?.startConversionRate)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 border-t border-trell-line px-4 py-4 sm:px-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {funnel.map((row) => (
            <div
              key={row.label}
              title={`${row.label}: ${fmtInt.format(row.value)}`}
              className="flex items-center gap-3"
            >
              <span className="w-24 shrink-0 truncate text-[13px] text-neutral-600 dark:text-neutral-400">
                {row.label}
              </span>
              <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-r-full bg-neutral-100 dark:bg-white/10">
                <div
                  className={`h-full rounded-l-none rounded-r-full ${row.bar}`}
                  style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / funnelMax) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums text-trell-ink">
                {fmtInt.format(row.value)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 lg:flex-col lg:justify-center lg:gap-4">
          <div className="min-w-0 flex-1 rounded-lg border border-trell-line px-3 py-2.5 lg:flex-none">
            <div className="text-xs text-trell-ink-muted">view → submit</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums text-trell-ink">{fmtRate(viewToSubmit)}</div>
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-trell-line px-3 py-2.5 lg:flex-none">
            <div className="text-xs text-trell-ink-muted">start → success</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums text-trell-ink">
              {fmtRate(metrics.startConversionRate)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
