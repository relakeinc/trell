"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { eventLabel } from "@/lib/labels";

interface Metrics {
  events: number;
  views: number;
  starts: number;
  submits: number;
  successes: number;
  abandons: number;
  ctaClicks: number;
  fieldInteractions: number;
  sessions: number;
  visitors: number;
  conversionRate: number | null;
  startConversionRate: number | null;
  avgTimeToCompleteMs: number | null;
  bounceRate: number | null;
  pagesPerSession: number | null;
  avgScrollDepth: number | null;
  avgTimeOnPageMs: number | null;
}

interface TimelinePoint {
  date: string;
  views: number;
  starts: number;
  successes: number;
}

interface Row {
  key: string;
  count: number;
}

interface FormRow {
  id: string;
  name: string | null;
  events: number;
  successes: number;
  conversionRate: number | null;
}

interface DrillEvent {
  eventId: string;
  type: string;
  ts: string;
  pagePath: string;
  formId: string | null;
  formName: string | null;
  deviceType: string;
  browser: string | null;
  os: string | null;
  sessionId: string;
  visitorId: string;
  utmSource: string | null;
  utmMedium: string | null;
}

const DIMS = ["page", "utm_source", "utm_medium", "device", "browser", "os"] as const;
const DIM_LABEL: Record<string, string> = {
  page: "Pages",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  device: "Devices",
  browser: "Browsers",
  os: "OS",
};

function localInput(d: Date): string {
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

export default function AnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000))); // tomorrow to cover all of today
  const [interval, setInterval] = useState("day");
  const [dim, setDim] = useState<(typeof DIMS)[number]>("page");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [series, setSeries] = useState<TimelinePoint[]>([]);
  const [breakdown, setBreakdown] = useState<Row[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [events, setEvents] = useState<DrillEvent[]>([]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [from, to]);

  const pct = (x: number | null) =>
    x == null ? "–" : (x * 100).toFixed(x >= 0.1 ? 1 : 2) + "%";
  const human = (ms: number | null) => {
    if (ms == null) return "–";
    const s = ms / 1000;
    if (s < 60) return s.toFixed(1) + "s";
    const m = s / 60;
    return m < 60 ? m.toFixed(1) + "m" : (m / 60).toFixed(1) + "h";
  };

  // We need the project ID — fetch from the API using slug
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const p = (d.projects ?? []).find((x: { slug: string }) => x.slug === slug);
        if (p) setProjectId(p.id);
      })
      .catch(() => {});
  }, [slug]);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const base = `/api/projects/${projectId}`;
      const [s, se, b, f, e] = await Promise.all([
        fetch(`${base}/stats?${qs}`).then((r) => r.json()),
        fetch(`${base}/series?interval=${interval}&${qs}`).then((r) => r.json()),
        fetch(`${base}/breakdown?dimension=${dim}&${qs}`).then((r) => r.json()),
        fetch(`${base}/forms?${qs}`).then((r) => r.json()),
        fetch(`${base}/events?limit=15&${qs}`).then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error.message ?? s.error);
      setMetrics(s.metrics);
      setSeries(se.series ?? []);
      setBreakdown(b.rows ?? []);
      setForms(f.forms ?? []);
      setEvents(e.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, qs, interval, dim]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const areaMax = useMemo(() => Math.max(1, ...series.map((p) => p.views)), [series]);
  const chartPath = useMemo(() => {
    const n = series.length;
    if (n === 0) return { line: "", area: "", dot: null };
    const pts = series.map((p, i) => ({
      x: n <= 1 ? 10 : (i / (n - 1)) * 90 + 5,
      y: 100 - (p.views / areaMax) * 100,
    }));
    if (pts.length === 1) {
      const p = pts[0]!;
      return {
        line: "",
        area: "",
        dot: p,
      };
    }
    const catmull = pts.map((p, i) => {
      const prev = pts[i - 1] ?? p;
      const next = pts[i + 1] ?? p;
      const tension = 0.3;
      const cp1x = p.x - (next.x - prev.x) * tension;
      const cp1y = p.y - (next.y - prev.y) * tension;
      const cp2x = p.x + (next.x - prev.x) * tension;
      const cp2y = p.y + (next.y - prev.y) * tension;
      return { p, cp1x, cp1y, cp2x, cp2y };
    });
    let line = `M${catmull[0]!.p.x},${catmull[0]!.p.y}`;
    for (let i = 1; i < catmull.length; i++) {
      const c = catmull[i]!;
      const prev = catmull[i - 1]!;
      line += ` C${prev.cp2x},${prev.cp2y} ${c.cp1x},${c.cp1y} ${c.p.x},${c.p.y}`;
    }
    const area = `${line} L${catmull[catmull.length - 1]!.p.x},100 L${catmull[0]!.p.x},100 Z`;
    return { line, area, dot: null };
  }, [series, areaMax]);

  const totalBreakdown = breakdown.reduce((a, r) => a + r.count, 0);

  return (
    <div className="trell-content">
      {/* Header */}
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="text-base font-semibold text-trell-ink">Analytics</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchAll()}
            className="trell-btn-outline h-9 gap-1.5"
          >
            <Icon name="refresh-right" size={16} className={loading ? "animate-spin" : ""} />
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
        <MetricCell label="Avg time" value={human(metrics?.avgTimeToCompleteMs ?? null)} loading={loading} color="text-green-600" />
      </div>

      {/* Secondary KPIs */}
      <div className="mb-6 grid grid-cols-2 divide-x divide-trell-line overflow-hidden rounded-xl border border-trell-line bg-white sm:grid-cols-4">
        <MetricCell label="Bounce rate" value={pct(metrics?.bounceRate ?? null)} loading={loading} color="text-orange-500" />
        <MetricCell label="Pages/session" value={(metrics?.pagesPerSession ?? 0).toFixed(1)} loading={loading} color="text-purple-500" />
        <MetricCell label="Avg scroll" value={metrics?.avgScrollDepth != null ? Math.round(metrics.avgScrollDepth) + "%" : "—"} loading={loading} color="text-cyan-600" />
        <MetricCell label="Avg time on page" value={human(metrics?.avgTimeOnPageMs ?? null)} loading={loading} color="text-teal-600" />
      </div>

      {/* Area chart */}
      <div className="mb-6 rounded-xl border border-trell-line bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-trell-ink">Form views over time</span>
          <span className="text-xs text-trell-ink-muted">{series.length} buckets</span>
        </div>
        <div className="flex">
          {/* Y-axis labels */}
          {series.length > 0 && (
            <div className="flex w-8 shrink-0 flex-col justify-between py-1 pr-1 text-right text-2xs text-trell-ink-muted">
              <span>{areaMax}</span>
              <span>{Math.round(areaMax * 0.75)}</span>
              <span>{Math.round(areaMax * 0.5)}</span>
              <span>{Math.round(areaMax * 0.25)}</span>
              <span>0</span>
            </div>
          )}
          <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-56 w-full">
            <defs>
              <linearGradient id="trell-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line key={pct} x1="0" y1={pct * 50} x2="100" y2={pct * 50} stroke="#e5e7eb" strokeWidth="0.3" strokeDasharray={pct === 0 ? "0" : "0.8 0.8"} />
            ))}
            {chartPath.dot ? (
              <circle
                cx={chartPath.dot.x}
                cy={chartPath.dot.y}
                r="4"
                fill="#2563eb"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <>
                {chartPath.area && (
                  <path d={chartPath.area} fill="url(#trell-area)" />
                )}
                {chartPath.line && (
                  <path d={chartPath.line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                )}
              </>
            )}
          </svg>
        </div>
        {loading && !series.length && (
          <p className="py-8 text-center text-sm text-trell-ink-muted">Loading…</p>
        )}
        {!loading && series.length === 0 && (
          <p className="py-8 text-center text-sm text-trell-ink-muted">No data available</p>
        )}
        {series.length > 0 && (
          <div className="flex justify-between border-t border-trell-line px-1 pt-2 text-2xs text-trell-ink-muted">
            <span>{fmtShortDate(series[0]!.date)}</span>
            <span>{fmtShortDate(series[series.length - 1]!.date)}</span>
          </div>
        )}
      </div>

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
          <table className="w-full text-sm">
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
          <table className="w-full text-sm">
            <tbody>
              {events.slice(0, 8).map((e, i) => (
                <tr key={i} className="border-b border-trell-line last:border-0">
                  <td className="py-2 text-trell-ink-default">{eventLabel(e.type)}</td>
                  <td className="py-2 text-trell-ink-muted">{e.formId ?? "–"}</td>
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
  return (
    <div className="relative flex h-full min-w-0 flex-col px-4 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5 text-sm text-neutral-600">
        <div className={`h-2 w-2 rounded-sm bg-current ${color}`} />
        <span>{label}</span>
      </div>
      <div className="mt-1 flex h-12 items-center">
        {loading && (value === 0 || value === "0") ? (
          <div className="h-9 w-16 animate-pulse rounded-md bg-neutral-200" />
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
  return (
    <div className="rounded-lg border border-trell-line bg-white p-3">
      <div className="text-xl font-medium tabular-nums text-trell-ink">
        {loading && value === 0 ? "…" : value}
      </div>
      <div className="mt-1 text-2xs text-neutral-500">{label}</div>
    </div>
  );
}
