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

const fullFmt = new Intl.NumberFormat("en");

export function FunnelView({
  funnel,
  onDrillDown,
}: {
  funnel: { id: string; name: string } & FunnelData;
  onDrillDown?: (step: FunnelStep) => void;
}) {
  const first = funnel.steps[0]?.count ?? 0;
  const last = funnel.steps.length > 0 ? (funnel.steps[funnel.steps.length - 1]?.count ?? 0) : 0;
  const overall = first > 0 && funnel.steps.length > 1 ? last / first : null;

  return (
    <div className="rounded-2xl border border-trell-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-trell-ink">
            <span className="border-b border-dotted border-neutral-300 pb-0.5">{funnel.name}</span>
          </h3>
          <div className="mt-1 text-xs text-neutral-500">
            {fullFmt.format(funnel.totalSessions)} sessions entered this funnel
          </div>
        </div>
        {overall != null && (
          <div className="text-right">
            <div className="text-[28px] font-semibold tabular-nums leading-8 text-trell-ink">{pct(overall)}</div>
            <div className="mt-0.5 text-xs text-neutral-500">overall conversion</div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {funnel.steps.map((step, i) => {
          const width = first > 0 ? (step.count / first) * 100 : 0;
          return (
            <div key={step.position}>
              {i > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 pl-9">
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-green-700">
                    ↓ {pct(step.conversionFromPrevious)} continue
                  </span>
                  {step.dropOff != null && step.dropOff > 0 && (
                    <span className="text-xs tabular-nums text-red-500">{pct(step.dropOff)} drop off</span>
                  )}
                </div>
              )}
              <div
                className={`group flex items-center gap-3 ${onDrillDown ? "cursor-pointer" : ""}`}
                onClick={() => onDrillDown?.(step)}
                title={onDrillDown ? "Click to inspect sessions" : undefined}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-trell-ink">
                      {step.label}
                      <span className="ml-2 truncate font-normal text-neutral-400">{step.key}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-trell-ink">
                      {fullFmt.format(step.count)}
                    </span>
                  </div>
                  <div className="h-3.5 w-full overflow-hidden">
                    <div
                      className="h-full rounded-l-none rounded-r-full transition-all duration-500 group-hover:brightness-110"
                      style={{
                        width: `${Math.max(step.count > 0 ? 2 : 0, width)}%`,
                        background: "var(--accent, #2563eb)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {funnel.steps.length === 0 && (
        <p className="py-8 text-center text-sm text-trell-ink-muted">This funnel has no steps yet.</p>
      )}
    </div>
  );
}
