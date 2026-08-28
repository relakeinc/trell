"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { useProjectId, useProjectStats } from "@/lib/hooks";
import { localInput } from "@/lib/format";

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
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

export default function ComparisonPage() {
  const { projectId } = useProjectId();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [compFrom, setCompFrom] = useState(localInput(new Date(Date.now() - 14 * 86400000)));
  const [compTo, setCompTo] = useState(localInput(new Date(Date.now() - 7 * 86400000)));
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  async function runComparison() {
    if (!projectId) return;
    setComparing(true);
    try {
      const base = `/api/projects/${projectId}`;
      const [b, c] = await Promise.all([
        fetch(`${base}/stats?from=${compFrom}&to=${compTo}`).then((r) => r.json()),
        fetch(`${base}/stats?from=${from}&to=${to}`).then((r) => r.json()),
      ]);
      if (b.comparison) { setComparison(b.comparison); return; }
      const keys = ["events", "views", "starts", "submits", "successes", "conversionRate", "startConversionRate", "sessions", "visitors"];
      const deltas: ComparisonResult["deltas"] = {};
      for (const k of keys) {
        const bv = b.metrics?.[k] ?? 0;
        const cv = c.metrics?.[k] ?? 0;
        const absolute = cv - bv;
        deltas[k] = { absolute, percentage: bv !== 0 ? (absolute / bv) * 100 : null, direction: absolute > 0 ? "up" : absolute < 0 ? "down" : "flat" };
      }
      setComparison({ baseline: b.metrics, compare: c.metrics, deltas });
    } catch { /* ignore */ }
    setComparing(false);
  }

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="text-base font-semibold text-trell-ink">Comparison</h1>
        <button
          onClick={() => comparison && exportComparisonCSV(comparison)}
          disabled={!comparison}
          className="trell-btn-primary flex h-9 cursor-pointer items-center gap-1.5 disabled:opacity-40"
        >
          <Icon name="download" size={16} />
          Export CSV
        </button>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); void runComparison(); }} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-trell-ink-muted">Previous period from</label>
          <input type="datetime-local" value={compFrom} onChange={(e) => setCompFrom(e.target.value)} className="trell-input h-9 w-full" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-trell-ink-muted">Previous period to</label>
          <input type="datetime-local" value={compTo} onChange={(e) => setCompTo(e.target.value)} className="trell-input h-9 w-full" />
        </div>
        <div className="flex h-9 min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-trell-line bg-neutral-50 px-3 text-sm text-trell-ink-subtle">
          <Icon name="calendar-2" size={15} />
          <span className="truncate">{formatDate(from)} → {formatDate(to)}</span>
        </div>
        <button type="submit" disabled={comparing} className="trell-btn-primary h-9 px-6 disabled:opacity-50">{comparing ? "Comparing…" : "Compare"}</button>
      </form>

      {comparison && <ComparisonPanel data={comparison} />}

      {!comparison && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-trell-line bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-trell-line bg-white text-trell-ink-subtle">
            <Icon name="filter-square" size={24} />
          </div>
          <h2 className="text-base font-semibold text-trell-ink">Compare periods</h2>
          <p className="mt-1.5 max-w-sm text-sm text-trell-ink-subtle">Select a baseline period and click Compare to see how your metrics changed.</p>
          <button onClick={() => void runComparison()} className="trell-btn-primary mt-4">Compare now</button>
        </div>
      )}
    </div>
  );
}
