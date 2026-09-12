"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { fmtShortDate } from "@/lib/format";

interface TrendPoint {
  date: string;
  views: number;
  starts?: number;
  successes?: number;
}

type MetricKey = "views" | "starts" | "successes";
type Variant = "area" | "bars";

const METRICS: { key: MetricKey; label: string; title: string; color: string }[] = [
  { key: "views", label: "Views", title: "Form views over time", color: "#2563eb" },
  { key: "starts", label: "Starts", title: "Form starts over time", color: "#7c3aed" },
  { key: "successes", label: "Conversions", title: "Conversions over time", color: "#059669" },
];

const PREV_COLOR = "#94a3b8";

// Plot box: bottom 8% clears date labels, top 8% gives the line headroom.
const TOP = 8;
const BOTTOM = 92;
const SPAN = BOTTOM - TOP;

const fullFmt = new Intl.NumberFormat("en");

function fmtAxis(v: number): string {
  if (Number.isInteger(v)) {
    return Math.abs(v) >= 10000
      ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)
      : fullFmt.format(v);
  }
  return String(Math.round(v * 10) / 10);
}

function val(p: TrendPoint | undefined, m: MetricKey): number {
  if (!p) return 0;
  if (m === "views") return p.views ?? 0;
  if (m === "starts") return p.starts ?? 0;
  return p.successes ?? 0;
}

/** Clean axis: step ∈ 1/2/5×10^n, max = 3 steps → gridlines always land on round numbers. */
function axisStep(dataMax: number): { step: number; max: number } {
  if (dataMax <= 0) return { step: 1, max: 3 };
  const raw = dataMax / 3;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  const step = nf * p;
  return { step, max: step * 3 };
}

function smoothLine(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0]!.x},${pts[0]!.y} L${pts[0]!.x},${pts[0]!.y}`;
  const k = 0.16;
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(n - 1, i + 2)]!;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * (1 + k);
    const c1y = p1.y + ((p2.y - p0.y) / 6) * (1 + k);
    const c2x = p2.x - ((p3.x - p1.x) / 6) * (1 + k);
    const c2y = p2.y - ((p3.y - p1.y) / 6) * (1 + k);
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function rangeLabel(pts: TrendPoint[]): string {
  if (pts.length === 0) return "";
  const a = fmtShortDate(pts[0]!.date);
  const b = fmtShortDate(pts[pts.length - 1]!.date);
  return a === b ? a : `${a} – ${b}`;
}

export function AreaChart({
  series,
  comparison,
  loading,
}: {
  series: TrendPoint[];
  comparison?: TrendPoint[];
  loading: boolean;
}) {
  const [metric, setMetric] = useState<MetricKey>("views");
  const [variant, setVariant] = useState<Variant>("area");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const gradId = useId();
  const clipId = useId();

  const meta = METRICS.find((m) => m.key === metric) ?? METRICS[0]!;
  const prev = comparison && comparison.length > 0 ? comparison : null;

  const cur = useMemo(() => series.map((p) => val(p, metric)), [series, metric]);
  const prv: (number | null)[] = useMemo(
    () => series.map((_, i) => (prev && i < prev.length ? val(prev[i], metric) : null)),
    [prev, series, metric],
  );

  const { step, max: axisMax } = useMemo(
    () => axisStep(Math.max(0, ...cur, ...prv.filter((v): v is number => v != null))),
    [cur, prv],
  );
  const gridVals = [0, step, step * 2, step * 3];

  const total = useMemo(() => cur.reduce((a, b) => a + b, 0), [cur]);
  const prevTotal = useMemo(
    () => (prev ? series.reduce((a, _, i) => a + (i < prev.length ? val(prev[i], metric) : 0), 0) : null),
    [prev, series, metric],
  );
  const delta = prevTotal != null && prevTotal > 0 ? (total - prevTotal) / prevTotal : null;

  const n = series.length;
  const x = (i: number) => (n <= 1 ? 50 : 3 + (i / (n - 1)) * 94);
  const y = (v: number) => BOTTOM - (Math.max(0, Math.min(v, axisMax)) / axisMax) * SPAN;

  const line = useMemo(
    () => smoothLine(series.map((_, i) => ({ x: x(i), y: y(cur[i] ?? 0) }))),
    [series, cur, axisMax],
  );
  const prevLine = useMemo(() => {
    if (!prev) return "";
    const pts = series
      .map((_, i) => ({ i, v: i < prev.length ? val(prev[i], metric) : null }))
      .filter((p): p is { i: number; v: number } => p.v != null)
      .map((p) => ({ x: x(p.i), y: y(p.v) }));
    return smoothLine(pts);
  }, [prev, series, metric, axisMax]);
  const area = line ? `${line} L${x(n - 1)},${BOTTOM} L${x(0)},${BOTTOM} Z` : "";

  const ticks = useMemo(() => {
    if (n === 0) return [];
    const count = Math.min(5, n);
    const out: { i: number; label: string }[] = [];
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1 || 1)) * (n - 1));
      if (out.some((t) => t.i === i)) continue;
      out.push({ i, label: fmtShortDate(series[i]!.date) });
    }
    return out;
  }, [series, n]);

  function handleMove(e: React.MouseEvent) {
    const el = plotRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - mouseX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Only engage near a point (px): no mid-gap snapping, tooltip appears as you reach it.
    const bestPx = (bestD / 100) * rect.width;
    setHoverIdx(bestPx <= 32 ? best : null);
  }

  const hover = hoverIdx != null && hoverIdx < n ? hoverIdx : null;
  const hoverCur = hover != null ? (cur[hover] ?? 0) : 0;
  const hoverPrev = hover != null ? (prv[hover] ?? null) : null;
  const hoverDelta = hoverPrev != null && hoverPrev > 0 ? (hoverCur - hoverPrev) / hoverPrev : null;
  const tipY = hover != null ? y(hoverCur) : 0;
  const tipFlip = tipY < 32;

  const slot = n > 0 ? 94 / n : 0;
  // Bar widths in % of plot width, capped so few buckets don't turn into walls.
  const curW = prev ? Math.min(slot * 0.3, 3.2) : Math.min(slot * 0.52, 5);
  const prvW = Math.min(slot * 0.3, 3.2);

  return (
    <div className="mb-6 rounded-2xl border border-trell-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-trell-ink">
            <span className="border-b border-dotted border-neutral-300 pb-0.5">{meta.title}</span>
          </h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            {loading && total === 0 ? (
              <div className="trell-skeleton h-8 w-28" />
            ) : (
              <AnimatedNumber
                value={total}
                className="text-[28px] font-semibold tabular-nums leading-8 text-trell-ink"
              />
            )}
            {delta != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                  delta > 0
                    ? "bg-green-50 text-green-700"
                    : delta < 0
                      ? "bg-red-50 text-red-600"
                      : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {delta > 0 ? "↗" : delta < 0 ? "↘" : "→"}{" "}
                {Math.abs(delta * 100).toFixed(Math.abs(delta * 100) < 0.1 && delta !== 0 ? 2 : 1)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-neutral-100 p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setMetric(m.key);
                  setHoverIdx(null);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metric === m.key ? "bg-white text-trell-ink shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg bg-neutral-100 p-0.5">
            {(["area", "bars"] as Variant[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                title={v === "area" ? "Area chart" : "Bar chart"}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  variant === v ? "bg-white text-trell-ink shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(series.length > 0 || loading) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 rounded-full border-t-[3px]" style={{ borderColor: meta.color }} />
            {rangeLabel(series) || "Current period"}
          </span>
          {prev && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-dotted" style={{ borderColor: PREV_COLOR }} />
              {rangeLabel(prev) || "Previous period"}
            </span>
          )}
        </div>
      )}

      <div className="relative mt-3 flex">
        <div className="relative h-72 w-11 shrink-0">
          {gridVals.map((g, i) => (
            <span
              key={i}
              className="absolute right-0 -translate-y-1/2 pr-2 text-[11px] tabular-nums text-neutral-400"
              style={{ top: `${BOTTOM - (g / axisMax) * SPAN}%` }}
            >
              {fmtAxis(g)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {loading && n === 0 ? (
            <div className="trell-skeleton h-72 w-full rounded-xl" />
          ) : n === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center gap-1 rounded-xl bg-neutral-50 text-sm">
              <span className="font-medium text-trell-ink">No data for this period</span>
              <span className="text-xs text-trell-ink-muted">Try widening the date range</span>
            </div>
          ) : (
            <>
              <div
                ref={plotRef}
                className="relative h-72"
                onMouseMove={handleMove}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <svg
                  ref={svgRef}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                >
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={meta.color} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={meta.color} stopOpacity="0.02" />
                    </linearGradient>
                    <clipPath id={clipId}>
                      <rect x="0" y="0" width="100" height="100" rx="1" />
                    </clipPath>
                  </defs>

                  {gridVals.map((g, i) => (
                    <line
                      key={i}
                      x1="0"
                      y1={BOTTOM - (g / axisMax) * SPAN}
                      x2="100"
                      y2={BOTTOM - (g / axisMax) * SPAN}
                      stroke="currentColor"
                      className={
                        i === 0 ? "text-neutral-300 dark:text-white/20" : "text-neutral-200 dark:text-white/10"
                      }
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  <g clipPath={`url(#${clipId})`}>
                    {prev && variant === "area" && prevLine && (
                      <path
                        d={prevLine}
                        fill="none"
                        stroke={PREV_COLOR}
                        strokeWidth="1.6"
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        opacity="0.9"
                      />
                    )}

                    {variant === "area" && (
                      <>
                        {area && <path d={area} fill={`url(#${gradId})`} />}
                        {line && (
                          <path
                            d={line}
                            fill="none"
                            stroke={meta.color}
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </>
                    )}
                  </g>
                </svg>

                {/* Bars as HTML for crisp rounding; clipped so edge bars never overflow. */}
                {variant === "bars" && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {series.map((_, i) => {
                      const v = cur[i] ?? 0;
                      const pv = prv[i] ?? null;
                      const cx = x(i);
                      return (
                        <div key={i}>
                          {pv != null && pv > 0 && (
                            <div
                              className="absolute rounded-t-[5px]"
                              style={{
                                left: `${cx + 0.35 + curW / 2}%`,
                                width: `${prvW}%`,
                                bottom: `${100 - BOTTOM}%`,
                                height: `${(Math.min(pv, axisMax) / axisMax) * SPAN}%`,
                                background: meta.color,
                                opacity: 0.28,
                                transform: "translateX(-50%)",
                              }}
                            />
                          )}
                          {v > 0 && (
                            <div
                              className="absolute rounded-t-[5px]"
                              style={{
                                left: `${prev ? cx - 0.35 - prvW / 2 : cx}%`,
                                width: `${curW}%`,
                                bottom: `${100 - BOTTOM}%`,
                                height: `${(Math.min(v, axisMax) / axisMax) * SPAN}%`,
                                background: meta.color,
                                transform: "translateX(-50%)",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Hover layer stays mounted; CSS fades it so it never pops. */}
                <div
                  className="pointer-events-none absolute transition-opacity duration-150"
                  style={{
                    left: `${hover != null ? x(hover) : 50}%`,
                    top: `${TOP}%`,
                    bottom: `${100 - BOTTOM}%`,
                    width: 1,
                    background: "#cbd5e1",
                    opacity: hover != null ? 1 : 0,
                  }}
                />
                <div
                  className="pointer-events-none absolute z-10 h-3 w-3 rounded-full border-2 border-white shadow transition-all duration-150"
                  style={{
                    left: `${hover != null ? x(hover) : 50}%`,
                    top: `${hover != null ? y(hoverCur) : 50}%`,
                    transform: "translate(-50%, -50%)",
                    background: meta.color,
                    opacity: hover != null ? 1 : 0,
                  }}
                />
                {variant === "area" && (
                  <div
                    className="pointer-events-none absolute z-10 h-2.5 w-2.5 rounded-full border-2 border-white shadow transition-all duration-150"
                    style={{
                      left: `${hover != null ? x(hover) : 50}%`,
                      top: `${hover != null && hoverPrev != null && hoverPrev > 0 ? y(hoverPrev) : 50}%`,
                      transform: "translate(-50%, -50%)",
                      background: PREV_COLOR,
                      opacity: hover != null && hoverPrev != null && hoverPrev > 0 ? 1 : 0,
                    }}
                  />
                )}

                <div
                  className="pointer-events-none absolute z-20 min-w-36 rounded-xl border border-trell-line bg-white/95 px-3 py-2 shadow-xl backdrop-blur transition-all duration-150"
                  style={{
                    left: `${Math.min(86, Math.max(14, hover != null ? x(hover) : 50))}%`,
                    top: `${tipY}%`,
                    transform: tipFlip ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 14px))",
                    opacity: hover != null ? 1 : 0,
                  }}
                >
                  {hover != null && (
                    <>
                      <div className="mb-1 text-[11px] font-medium text-neutral-500">
                        {fmtShortDate(series[hover]!.date)}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-trell-ink">
                        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                        {fullFmt.format(hoverCur)}
                      </div>
                      {hoverPrev != null && (
                        <div className="mt-0.5 flex items-center justify-between gap-3 text-xs tabular-nums text-neutral-500">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-0 w-3 border-t-2 border-dotted" style={{ borderColor: PREV_COLOR }} />
                            {fullFmt.format(hoverPrev)}
                          </span>
                          {hoverDelta != null && (
                            <span
                              className={
                                hoverDelta > 0
                                  ? "font-semibold text-green-600"
                                  : hoverDelta < 0
                                    ? "font-semibold text-red-500"
                                    : ""
                              }
                            >
                              {hoverDelta > 0 ? "+" : ""}
                              {(hoverDelta * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="relative h-5">
                {ticks.map((t) => (
                  <span
                    key={t.i}
                    className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-neutral-400"
                    style={{ left: `${x(t.i)}%` }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
