"use client";

interface FunnelStep {
  position: number;
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  dropOff: number | null;
}

interface FunnelData {
  totalSessions: number;
  steps: FunnelStep[];
}

function pct(x: number | null): string {
  return x == null ? "–" : (x * 100).toFixed(1) + "%";
}

export function FunnelView({
  funnel,
  onDrillDown,
}: {
  funnel: { id: string; name: string } & FunnelData;
  onDrillDown?: (step: FunnelStep) => void;
}) {
  const maxCount = funnel.steps[0]?.count ?? funnel.totalSessions;

  return (
    <div className="trell-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{funnel.name}</span>
        <span className="text-xs text-trell-muted">{funnel.totalSessions} sessions</span>
      </div>
      <div className="space-y-0">
        {funnel.steps.map((step, i) => {
          const width = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
          return (
            <div key={step.position}>
              {i > 0 && (
                <div className="flex items-center gap-2 py-1 pl-6">
                  <span className="text-[10px] text-trell-muted">↓</span>
                  <span className="text-xs text-trell-muted">
                    {pct(step.conversionFromPrevious)} converted
                  </span>
                  {step.dropOff != null && step.dropOff > 0 && (
                    <span className="text-[10px] text-red-500">({pct(step.dropOff)} drop)</span>
                  )}
                </div>
              )}
              <div
                className={`flex items-center gap-3 rounded-md px-3 py-2 ${onDrillDown ? "cursor-pointer hover:bg-trell-bg" : ""}`}
                onClick={() => onDrillDown?.(step)}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-sm tabular-nums">{step.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-trell-bg">
                    <div
                      className="h-full rounded bg-trell-ink"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
