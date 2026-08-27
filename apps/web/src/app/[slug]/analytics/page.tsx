"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { EventBadge } from "@/components/EventBadge";
import { AreaChart } from "@/components/AreaChart";
import { useProjectId, useProjectStats, useProjectSeries, useProjectBreakdown, useProjectForms, useProjectEvents } from "@/lib/hooks";
import { localInput, pct, humanMs, fmtTime, rangeQs } from "@/lib/format";

const DIMS = ["page", "utm_source", "utm_medium", "device", "browser", "os"] as const;
const DIM_LABEL: Record<string, string> = {
  page: "Pages",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  device: "Devices",
  browser: "Browsers",
  os: "OS",
};

export default function AnalyticsPage() {
  const { projectId, isLoading: projectLoading } = useProjectId();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [interval, setInterval] = useState("day");
  const [dim, setDim] = useState<(typeof DIMS)[number]>("page");

  const qs = useMemo(() => rangeQs(from, to), [from, to]);

  const { data: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useProjectStats(projectId, qs);
  const { data: seriesData, isLoading: seriesLoading } = useProjectSeries(projectId, interval, qs);
  const { data: breakdownData } = useProjectBreakdown(projectId, dim, qs);
  const { data: formsData } = useProjectForms(projectId, qs);
  const { data: eventsData } = useProjectEvents(projectId, qs, 15);

  const metrics = statsData?.metrics ?? null;
  const series = seriesData?.series ?? [];
  const breakdown = breakdownData?.rows ?? [];
  const forms = formsData?.forms ?? [];
  const events = eventsData?.events ?? [];

  const loading = projectLoading || statsLoading;
  const error = statsError ? "Failed to load analytics" : statsData?.error?.message ?? null;

  const totalBreakdown = breakdown.reduce((a, r) => a + r.count, 0);

  return (
    <div className="trell-content">
      {/* Header */}
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="text-base font-semibold text-trell-ink">Analytics</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetchStats()}
            className="trell-btn-outline h-9 gap-1.5"
          >
            <Icon name="refresh-right" size={16} className={statsLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 divide-x divide-trell-line overflow-hidden rounded-xl border border-trell-line bg-white sm:grid-cols-4">
        <MetricCell label="Form views" value={metrics?.views ?? 0} loading={loading} color="text-blue-500" />
        <MetricCell label="Conversions" value={metrics?.successes ?? 0} loading={loading} color="text-green-600" />
        <MetricCell label="Conversion rate" value={pct(metrics?.conversionRate ?? null)} loading={loading} color="text-blue-500" />
        <MetricCell label="Avg time" value={humanMs(metrics?.avgTimeToCompleteMs ?? null)} loading={loading} color="text-green-600" />
      </div>

      {/* Secondary KPIs */}
      <div className="mb-6 grid grid-cols-2 divide-x divide-trell-line overflow-hidden rounded-xl border border-trell-line bg-white sm:grid-cols-4">
        <MetricCell label="Bounce rate" value={pct(metrics?.bounceRate ?? null)} loading={loading} color="text-orange-500" />
        <MetricCell label="Pages/session" value={(metrics?.pagesPerSession ?? 0).toFixed(1)} loading={loading} color="text-purple-500" />
        <MetricCell label="Avg scroll" value={metrics?.avgScrollDepth != null ? Math.round(metrics.avgScrollDepth) + "%" : "\u2014"} loading={loading} color="text-cyan-600" />
        <MetricCell label="Avg time on page" value={humanMs(metrics?.avgTimeOnPageMs ?? null)} loading={loading} color="text-teal-600" />
      </div>

      {/* Area chart */}
      <AreaChart series={series} loading={seriesLoading} />

      {/* 2x2 panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard
          tabs={DIMS.map((d) => ({ id: d, label: DIM_LABEL[d]! }))}
          selectedTab={dim}
          onSelectTab={(id) => setDim(id as (typeof DIMS)[number])}
          title="Sources"
        >
          <BarList
            rows={breakdown.map((r) => ({ k: r.key, n: r.count }))}
            total={totalBreakdown}
            color="bg-blue-500"
          />
        </PanelCard>

        <PanelCard title="Forms">
          <table className="trell-table w-full text-sm">
            <tbody>
              {forms.slice(0, 10).map((f) => (
                <tr key={f.id} className="border-b border-trell-line last:border-0">
                  <td className="py-2 font-medium text-trell-ink">{f.name ?? f.id}</td>
                  <td className="py-2 text-right text-trell-ink-muted">{f.events}</td>
                  <td className="py-2 text-right text-trell-ink-muted">{pct(f.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {forms.length === 0 && (
            <p className="py-6 text-center text-sm text-trell-ink-muted">No data available</p>
          )}
        </PanelCard>

        <PanelCard title="Recent events">
          <table className="trell-table w-full text-sm">
            <tbody>
              {events.slice(0, 8).map((e, i) => (
                <tr key={i} className="border-b border-trell-line last:border-0">
                  <td className="py-2"><EventBadge type={e.type} /></td>
                  <td className="py-2 text-trell-ink-muted">{e.formId ?? "\u2013"}</td>
                  <td className="py-2 text-right text-trell-ink-muted">{fmtTime(e.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <p className="py-6 text-center text-sm text-trell-ink-muted">No data available</p>
          )}
        </PanelCard>

        <PanelCard title="Metrics">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Starts" value={metrics?.starts ?? 0} loading={loading} />
            <MiniStat label="Submits" value={metrics?.submits ?? 0} loading={loading} />
            <MiniStat label="Abandons" value={metrics?.abandons ?? 0} loading={loading} />
            <MiniStat label="Completion after start" value={pct(metrics?.startConversionRate ?? null)} loading={loading} />
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────

function MetricCell({ label, value, loading, color }: { label: string; value: string | number; loading: boolean; color: string }) {
  const isNumeric = typeof value === "number";
  return (
    <div className="relative flex h-full min-w-0 flex-col px-4 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5 text-sm text-neutral-600">
        <div className={`h-2 w-2 rounded-sm bg-current ${color}`} />
        <span>{label}</span>
      </div>
      <div className="mt-1 flex h-12 items-center">
        {loading && (value === 0 || value === "0") ? (
          <div className="trell-skeleton h-9 w-16" />
        ) : isNumeric ? (
          <AnimatedNumber value={value} className="text-xl font-medium tabular-nums text-trell-ink sm:text-3xl" />
        ) : (
          <span className="text-xl font-medium tabular-nums text-trell-ink sm:text-3xl">{value}</span>
        )}
      </div>
    </div>
  );
}

function PanelCard({ title, tabs, selectedTab, onSelectTab, children }: {
  title: string;
  tabs?: { id: string; label: string }[];
  selectedTab?: string;
  onSelectTab?: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
      <div className="flex items-center justify-between border-b border-trell-line px-4">
        <span className="py-3 text-sm font-medium text-trell-ink">{title}</span>
        {tabs && selectedTab && onSelectTab && (
          <div className="flex items-center gap-1 py-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                className={
                  selectedTab === t.id
                    ? "rounded-md bg-neutral-200 px-2 py-1 text-xs font-medium text-trell-ink"
                    : "rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BarList({ rows, total, color }: { rows: { k: string; n: number }[]; total: number; color: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-trell-ink-muted">No data available</p>;
  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-neutral-100">
            <div className={`absolute inset-y-0 left-0 rounded-md ${color}`} style={{ width: `${total ? Math.max(3, (r.n / total) * 100) : 3}%` }} />
            <span className="absolute inset-y-0 left-2 flex items-center text-xs text-neutral-700">{r.k}</span>
          </div>
          <span className="w-16 text-right text-sm tabular-nums text-neutral-600">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) {
  const isNumeric = typeof value === "number";
  return (
    <div className="rounded-lg border border-trell-line bg-white p-3">
      <div className="text-xl font-medium tabular-nums text-trell-ink">
        {loading && value === 0 ? (
          <span className="trell-skeleton inline-block h-6 w-12" />
        ) : isNumeric ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      <div className="mt-1 text-2xs text-neutral-500">{label}</div>
    </div>
  );
}
