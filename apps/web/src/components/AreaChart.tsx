"use client";

import { useMemo, useRef, useState } from "react";
import { fmtShortDate } from "@/lib/format";

interface SeriesPoint {
  date: string;
  views: number;
}

export function AreaChart({ series, loading }: { series: SeriesPoint[]; loading: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const areaMax = useMemo(() => Math.max(1, ...series.map((p) => p.views)), [series]);

  const pts = useMemo(() => {
    const n = series.length;
    if (n === 0) return [];
    return series.map((p, i) => ({
      x: (i / (n - 1)) * 90 + 5,
      y: 100 - (p.views / areaMax) * 100,
      views: p.views,
      date: p.date,
    }));
  }, [series, areaMax]);

  const chartPath = useMemo(() => {
    const n = pts.length;
    if (n === 0) return { line: "", area: "" };
    if (n === 1) {
      const y = pts[0]!.y;
      return { line: `M5,${y} L95,${y}`, area: `M5,${y} L95,${y} L95,100 L5,100 Z` };
    }
    const catmull = pts.map((p, i) => {
      const prev = pts[i - 1] ?? p;
      const next = pts[i + 1] ?? p;
      const tension = 0.3;
      return {
        p,
        cp1x: p.x - (next.x - prev.x) * tension,
        cp1y: p.y - (next.y - prev.y) * tension,
        cp2x: p.x + (next.x - prev.x) * tension,
        cp2y: p.y + (next.y - prev.y) * tension,
      };
    });
    let line = `M${catmull[0]!.p.x},${catmull[0]!.p.y}`;
    for (let i = 1; i < catmull.length; i++) {
      const c = catmull[i]!;
      const prev = catmull[i - 1]!;
      line += ` C${prev.cp2x},${prev.cp2y} ${c.cp1x},${c.cp1y} ${c.p.x},${c.p.y}`;
    }
    const area = `${line} L${catmull[catmull.length - 1]!.p.x},100 L${catmull[0]!.p.x},100 Z`;
    return { line, area };
  }, [pts]);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || pts.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i]!.x - mouseX);
      if (d < minDist) { minDist = d; closest = i; }
    }
    setHoverIdx(closest);
  }

  const hover = hoverIdx != null ? pts[hoverIdx] : null;

  return (
    <div className="mb-6 rounded-xl border border-trell-line bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-trell-ink">Form views over time</span>
        <span className="text-xs text-trell-ink-muted">{series.length} buckets</span>
      </div>
      <div className="relative flex">
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
        <svg
          ref={svgRef}
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
          className="h-56 w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="trell-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((pctVal) => (
            <line key={pctVal} x1="0" y1={pctVal * 50} x2="100" y2={pctVal * 50} stroke="#e5e7eb" strokeWidth="0.3" strokeDasharray={pctVal === 0 ? "0" : "0.8 0.8"} />
          ))}
          {chartPath.area && <path d={chartPath.area} fill="url(#trell-area)" />}
          {chartPath.line && <path d={chartPath.line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}

          {/* Hover crosshair + dot */}
          {hover && (
            <>
              <line x1={hover.x} y1="0" x2={hover.x} y2="50" stroke="#94a3b8" strokeWidth="0.3" strokeDasharray="0.5 0.5" />
              <circle cx={hover.x} cy={hover.y} r="1.5" fill="#2563eb" stroke="white" strokeWidth="0.5" />
            </>
          )}

          {/* Invisible hit areas for each point */}
          {pts.map((p, i) => (
            <rect
              key={i}
              x={p.x - 100 / pts.length / 2}
              y="0"
              width={100 / pts.length}
              height="50"
              fill="transparent"
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-trell-line bg-white px-3 py-2 shadow-lg"
            style={{
              left: `${((hover.x / 100) * (svgRef.current?.getBoundingClientRect().width ?? 0)) + (svgRef.current?.getBoundingClientRect().left ?? 0) - (svgRef.current?.parentElement?.getBoundingClientRect().left ?? 0)}px`,
              top: "4px",
            }}
          >
            <div className="text-xs font-medium text-trell-ink">{hover.views.toLocaleString()} views</div>
            <div className="text-2xs text-trell-ink-muted">{fmtShortDate(hover.date)}</div>
          </div>
        )}
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
  );
}
