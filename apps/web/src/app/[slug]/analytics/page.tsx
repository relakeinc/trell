"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/components/Icon";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { DateTimeField } from "@/components/DateTimeField";
import { SelectField } from "@/components/SelectField";
import { useMounted } from "@/components/Transitions";
import { DimIcon } from "@/components/DimIcon";
import { AreaChart } from "@/components/AreaChart";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AskYoiButton } from "@/components/AskYoiButton";
import { EventsFeed } from "@/components/analytics/EventsFeed";
import { FormsRanking } from "@/components/analytics/FormsRanking";
import {
  useProjectId,
  useProjectStats,
  useProjectSeries,
  useProjectBreakdown,
  useProjectForms,
  useProjectEvents,
  fetchBreakdown,
} from "@/lib/hooks";
import { localInput, pct, humanMs, fmtShortDate, rangeQs } from "@/lib/format";

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
  const { slug } = useParams<{ slug: string }>();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [interval, setInterval] = useState("day");
  const [dim, setDim] = useState<(typeof DIMS)[number]>("page");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preset, setPresetSel] = useState<number | null>(30);
  const filtersT = useMounted(filtersOpen, 150);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    function onDown(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  function setPreset(days: number) {
    const t = new Date();
    setTo(localInput(new Date(t.getTime() + 86400000)));
    setFrom(localInput(new Date(t.getTime() - days * 86400000)));
    setPresetSel(days);
  }

  const qs = useMemo(() => rangeQs(from, to), [from, to]);

  // Previous period of identical length, for the dotted comparison line + delta.
  const prevQs = useMemo(() => {
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    if (!Number.isFinite(f) || !Number.isFinite(t) || t <= f) return "";
    const dur = t - f;
    return rangeQs(localInput(new Date(f - dur)), localInput(new Date(f)));
  }, [from, to]);

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useProjectStats(projectId, qs);
  const { data: seriesData, isLoading: seriesLoading } = useProjectSeries(projectId, interval, qs);
  const { data: prevSeriesData } = useProjectSeries(projectId, interval, prevQs || null);
  const { data: breakdownData } = useProjectBreakdown(projectId, dim, qs);

  // Prefetch the other dimensions in parallel so switching tabs feels instant.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!projectId) return;
    for (const d of DIMS) {
      if (d === dim) continue;
      void queryClient.prefetchQuery({
        queryKey: ["breakdown", projectId, d, qs],
        queryFn: () => fetchBreakdown(projectId, d, qs),
        staleTime: 60_000,
      });
    }
  }, [projectId, qs, dim, queryClient]);
  const { data: formsData } = useProjectForms(projectId, qs);
  const { data: eventsData } = useProjectEvents(projectId, qs, 15);

  const metrics = statsData?.metrics ?? null;
  const series = seriesData?.series ?? [];
  const breakdown = breakdownData?.rows ?? [];
  const forms = formsData?.forms ?? [];
  const events = eventsData?.events ?? [];

  const loading = projectLoading || statsLoading;
  const error = statsError ? "Failed to load analytics" : (statsData?.error?.message ?? null);

  const totalBreakdown = breakdown.reduce((a, r) => a + r.count, 0);

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="hidden text-base font-semibold text-trell-ink md:block">Analytics</h1>
        <div className="ml-auto flex items-center gap-2">
          <div ref={filtersRef} className="relative">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className="trell-btn-outline h-9 gap-1.5"
              aria-expanded={filtersOpen}
            >
              <Icon name="filter-square" size={16} />
              <span className="hidden text-xs text-trell-ink-muted sm:inline">
                {fmtShortDate(from)} – {fmtShortDate(to)} ·{" "}
                {interval === "hour" ? "Hourly" : interval === "week" ? "Weekly" : "Daily"}
              </span>
              <span className="sm:hidden">Filters</span>
              <Icon
                name="arrow-down-01"
                size={14}
                className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              />
            </button>

            {filtersT.mounted && (
              <div
                className={`absolute right-0 z-30 mt-2 w-72 rounded-xl border border-trell-line bg-white p-4 shadow-xl ${filtersT.closing ? "trell-pop-out" : "trell-pop-in"}`}
              >
                <div className="mb-3 text-xs font-medium text-trell-ink-muted">Range</div>
                <div className="mb-3">
                  <SegmentedControl
                    className="w-full [&>div]:flex-1 [&_button]:w-full"
                    ariaLabel="Date range"
                    value={preset != null ? String(preset) : null}
                    onChange={(v) => setPreset(Number(v))}
                    options={[
                      { value: "7", label: "7D" },
                      { value: "30", label: "30D" },
                      { value: "90", label: "90D" },
                    ]}
                  />
                </div>
                <label className="mb-1 block text-xs text-trell-ink-muted">From</label>
                <div className="mb-3">
                  <DateTimeField
                    value={from}
                    onChange={(v) => {
                      setFrom(v);
                      setPresetSel(null);
                    }}
                  />
                </div>
                <label className="mb-1 block text-xs text-trell-ink-muted">To</label>
                <div className="mb-3">
                  <DateTimeField
                    value={to}
                    onChange={(v) => {
                      setTo(v);
                      setPresetSel(null);
                    }}
                  />
                </div>
                <label className="mb-1 block text-xs text-trell-ink-muted">Bucket interval</label>
                <div className="mb-4">
                  <SelectField
                    value={interval}
                    ariaLabel="Bucket interval"
                    onChange={setInterval}
                    options={[
                      { value: "hour", label: "Hourly", hint: "One bar per hour" },
                      { value: "day", label: "Daily", hint: "One bar per day" },
                      { value: "week", label: "Weekly", hint: "One bar per week" },
                    ]}
                  />
                </div>
                <button
                  onClick={() => {
                    void refetchStats();
                    setFiltersOpen(false);
                  }}
                  className="trell-btn-outline h-9 w-full justify-center gap-1.5"
                >
                  <Icon name="refresh-right" size={16} className={statsLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            )}
          </div>
          <AskYoiButton />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-6 grid grid-cols-2 divide-x divide-trell-line overflow-hidden rounded-xl border border-trell-line bg-white sm:grid-cols-4">
        <MetricCell
          label="Form views"
          value={metrics?.views ?? 0}
          loading={loading}
          color="text-blue-500"
          hint="Times a tracked form was seen"
        />
        <MetricCell
          label="Conversions"
          value={metrics?.successes ?? 0}
          loading={loading}
          color="text-green-600"
          dividerHint
          hint="Forms completed successfully"
        />
        <MetricCell
          label="Conversion rate"
          value={pct(metrics?.conversionRate ?? null)}
          loading={loading}
          color="text-blue-500"
          dividerHint
          hint="Successes ÷ form views"
        />
        <MetricCell
          label="Avg time"
          value={humanMs(metrics?.avgTimeToCompleteMs ?? null)}
          loading={loading}
          color="text-green-600"
          dividerHint
          hint="Average time from form start to success"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 divide-x divide-trell-line overflow-hidden rounded-xl border border-trell-line bg-white sm:grid-cols-4">
        <MetricCell
          label="Bounce rate"
          value={pct(metrics?.bounceRate ?? null)}
          loading={loading}
          color="text-orange-500"
          hint="Sessions with a single pageview"
        />
        <MetricCell
          label="Pages/session"
          value={(metrics?.pagesPerSession ?? 0).toFixed(1)}
          loading={loading}
          color="text-purple-500"
          dividerHint
          hint="Average pageviews per session"
        />
        <MetricCell
          label="Avg scroll"
          value={metrics?.avgScrollDepth != null ? Math.round(metrics.avgScrollDepth) + "%" : "\u2014"}
          loading={loading}
          color="text-cyan-600"
          dividerHint
          hint="Average deepest scroll per page"
        />
        <MetricCell
          label="Avg time on page"
          value={humanMs(metrics?.avgTimeOnPageMs ?? null)}
          loading={loading}
          color="text-teal-600"
          dividerHint
          hint="Average time before leaving a page"
        />
      </div>

      <AreaChart series={series} comparison={prevSeriesData?.series} loading={seriesLoading} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <EventsFeed events={events.slice(0, 6)} slug={slug ?? ""} />
        <FormsRanking forms={forms.slice(0, 6)} slug={slug ?? ""} />

        <PanelCard
          tabs={DIMS.map((d) => ({ id: d, label: DIM_LABEL[d]! }))}
          selectedTab={dim}
          onSelectTab={(id) => setDim(id as (typeof DIMS)[number])}
          title="Sources"
          metric="EVENTS"
          heightClass="h-[271px]"
          fade={false}
          cardClass="rounded-lg border border-[#e1e4eb] shadow-[0_1px_2px_0_rgba(24,24,27,0.05)] dark:border-white/10"
        >
          <BarList dim={dim} rows={breakdown.map((r) => ({ k: r.key, n: r.count }))} total={totalBreakdown} />
        </PanelCard>

        <PanelCard title="Metrics" flush auto>
          <div className="grid h-full grid-cols-2 auto-rows-fr gap-px bg-trell-line dark:bg-[#2a2a29]">
            <MetricTile color="bg-blue-500" label="Starts" value={metrics?.starts ?? 0} loading={loading} />
            <MetricTile color="bg-green-600" label="Submits" value={metrics?.submits ?? 0} loading={loading} />
            <MetricTile color="bg-orange-500" label="Abandons" value={metrics?.abandons ?? 0} loading={loading} />
            <MetricTile
              color="bg-teal-600"
              label="Completion"
              value={pct(metrics?.startConversionRate ?? null)}
              loading={loading}
            />
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────

function MetricCell({
  label,
  value,
  loading,
  color,
  dividerHint,
  hint,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  color: string;
  dividerHint?: boolean;
  hint?: string;
}) {
  const isNumeric = typeof value === "number";
  return (
    <div className="relative flex h-full min-w-0 flex-col px-4 py-3 sm:px-8 sm:py-6">
      {dividerHint && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-[9px] inline-flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-400 dark:border-white/20 dark:bg-neutral-900 dark:text-neutral-500"
        >
          <ChevronRight className="h-3 w-3" />
        </span>
      )}
      <div className="flex items-center gap-2.5 text-sm text-neutral-600">
        <div className={`h-2 w-2 rounded-sm bg-current ${color}`} />
        <span>{label}</span>
        {hint && (
          <span
            title={hint}
            aria-label={hint}
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neutral-300 text-[10px] leading-none text-neutral-400 dark:border-white/20 dark:text-neutral-500"
          >
            ?
          </span>
        )}
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

function PanelCard({
  title,
  metric,
  tabs,
  selectedTab,
  onSelectTab,
  flush,
  auto,
  heightClass,
  fade = true,
  cardClass,
  children,
}: {
  title: string;
  metric?: string;
  tabs?: { id: string; label: string }[];
  selectedTab?: string;
  onSelectTab?: (id: string) => void;
  flush?: boolean;
  auto?: boolean;
  heightClass?: string;
  fade?: boolean;
  cardClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${auto ? "" : `flex ${heightClass ?? "h-[400px]"} flex-col `}${cardClass ?? "rounded-lg border border-trell-line"} overflow-hidden bg-white`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-trell-line px-4">
        <span className="whitespace-nowrap py-3 text-sm font-medium text-trell-ink">
          <span className="border-b border-dotted border-neutral-300 pb-0.5">{title}</span>
        </span>
        <div className="flex min-w-0 items-center gap-3">
          {tabs && selectedTab && onSelectTab && (
            <SegmentedControl
              scrollable
              value={selectedTab}
              onChange={onSelectTab}
              options={tabs.map((t) => ({ value: t.id, label: t.label }))}
            />
          )}
        </div>
      </div>
      <div
        className={
          flush
            ? "min-h-0 flex-1 overflow-hidden"
            : `min-h-0 flex-1 overflow-y-auto p-4${fade ? " [mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]" : ""}`
        }
      >
        {children}
      </div>
    </div>
  );
}

function BarList({ dim, rows, total }: { dim: string; rows: { k: string; n: number }[]; total: number }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-trell-ink-muted">No data available</p>;
  const max = Math.max(1, ...rows.slice(0, 6).map((r) => r.n));
  const fmt = new Intl.NumberFormat("de-DE");
  return (
    <div className="space-y-3">
      {rows.slice(0, 6).map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-3"
          title={`${r.k}: ${fmt.format(r.n)} (${total ? ((r.n / total) * 100).toFixed(1) : "0"}%)`}
        >
          <span className="w-24 shrink-0 truncate text-[13px] text-neutral-500 dark:text-neutral-400">{r.k}</span>
          <DimIcon dim={dim} value={r.k} />
          <div className="h-8 min-w-0 flex-1 overflow-hidden rounded-md bg-neutral-200 dark:bg-white/10">
            <div
              className="h-full rounded-md transition-all duration-500"
              style={{ width: `${Math.max(2, (r.n / max) * 100)}%`, background: "#2563eb" }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[13px] tabular-nums text-neutral-500 dark:text-neutral-400">
            {fmt.format(r.n)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricTile({
  color,
  label,
  value,
  loading,
}: {
  color: string;
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  const isNumeric = typeof value === "number";
  return (
    <div className="flex min-h-[112px] min-w-0 flex-col justify-center bg-white p-5 dark:bg-[#191918]">
      <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
        <span className={`h-2 w-2 shrink-0 rounded-sm ${color}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[26px] font-semibold tabular-nums leading-8 text-trell-ink">
        {loading && value === 0 ? (
          <span className="trell-skeleton inline-block h-7 w-14" />
        ) : isNumeric ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
