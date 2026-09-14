"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { AskYoiButton } from "@/components/AskYoiButton";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { AreaChart } from "@/components/AreaChart";
import { useProjectId, useProjectStats, useProjectSeries } from "@/lib/hooks";
import { localInput, rangeQs } from "@/lib/format";
import { DateTimeField } from "@/components/DateTimeField";

interface ComparisonResult {
  baseline: Record<string, number | null>;
  compare: Record<string, number | null>;
  deltas: Record<string, { absolute: number; percentage: number | null; direction: "up" | "down" | "flat" }>;
}

function exportComparisonCSV(data: ComparisonResult) {
  const rows = [["Metric", "Baseline", "Current", "Change", "Direction"]];
  for (const [key, delta] of Object.entries(data.deltas)) {
    rows.push([
      key,
      String(data.baseline[key] ?? ""),
      String(data.compare[key] ?? ""),
      delta.percentage != null ? delta.percentage.toFixed(1) + "%" : "\u2013",
      delta.direction,
    ]);
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparison-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })
    );
  } catch {
    return iso;
  }
}

export default function ComparisonPage() {
  const { projectId } = useProjectId();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [compFrom, setCompFrom] = useState(localInput(new Date(Date.now() - 60 * 86400000)));
  const [compTo, setCompTo] = useState(localInput(new Date(Date.now() - 30 * 86400000)));

  const valid = useMemo(() => {
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    const cf = new Date(compFrom).getTime();
    const ct = new Date(compTo).getTime();
    return Number.isFinite(f) && Number.isFinite(t) && Number.isFinite(cf) && Number.isFinite(ct) && t > f && ct > cf;
  }, [from, to, compFrom, compTo]);

  // Everything is reactive: stats (with native comparison) + both series refetch on any change.
  const statsQs = useMemo(
    () =>
      valid
        ? `${rangeQs(from, to)}&compareFrom=${encodeURIComponent(compFrom)}&compareTo=${encodeURIComponent(compTo)}`
        : null,
    [valid, from, to, compFrom, compTo],
  );
  const curQs = useMemo(() => (valid ? rangeQs(from, to) : null), [valid, from, to]);
  const baseQs = useMemo(() => (valid ? rangeQs(compFrom, compTo) : null), [valid, compFrom, compTo]);

  const { data: statsData, isLoading: statsLoading } = useProjectStats(projectId, statsQs);
  const { data: curSeries, isLoading: curLoading } = useProjectSeries(projectId, "day", curQs);
  const { data: baseSeries, isLoading: baseLoading } = useProjectSeries(projectId, "day", baseQs);

  const comparison = statsData?.comparison ?? null;

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <div className="hidden md:block">
          <h1 className="text-base font-semibold text-trell-ink">Comparison</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => comparison && exportComparisonCSV(comparison)}
            disabled={!comparison}
            className="trell-btn-outline h-9 gap-1.5 disabled:opacity-40"
          >
            <Icon name="download" size={16} />
            Export CSV
          </button>
          <AskYoiButton />
        </div>
      </header>

      <div className="mb-6 rounded-2xl border border-trell-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-trell-ink">
              Current period <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[#2563eb]" />
            </legend>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-500">From</span>
                <DateTimeField value={from} onChange={setFrom} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-500">To</span>
                <DateTimeField value={to} onChange={setTo} />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-trell-ink">
              Previous period{" "}
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </legend>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-500">From</span>
                <DateTimeField value={compFrom} onChange={setCompFrom} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-500">To</span>
                <DateTimeField value={compTo} onChange={setCompTo} />
              </label>
            </div>
          </fieldset>
        </div>
        {!valid && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Each period needs a valid range where “to” is after “from”.
          </p>
        )}
      </div>

      <AreaChart series={curSeries?.series ?? []} comparison={baseSeries?.series} loading={curLoading || baseLoading} />

      {statsLoading && !comparison && <div className="trell-skeleton h-64 w-full rounded-2xl" />}

      {comparison && (
        <ComparisonPanel
          data={comparison}
          baselineLabel={`${formatDate(compFrom)} → ${formatDate(compTo)}`}
          compareLabel={`${formatDate(from)} → ${formatDate(to)}`}
        />
      )}

      {!comparison && !statsLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-trell-line bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-trell-line bg-white text-trell-ink-subtle">
            <Icon name="filter-square" size={24} />
          </div>
          <h2 className="text-base font-semibold text-trell-ink">No comparison yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-trell-ink-subtle">
            Pick two valid date ranges above — the chart and metrics update automatically.
          </p>
        </div>
      )}
    </div>
  );
}
