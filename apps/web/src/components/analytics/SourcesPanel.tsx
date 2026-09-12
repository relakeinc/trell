"use client";

type SourceRow = { key: string; count: number };
type Dim = { id: string; label: string };

type SourcesPanelProps = {
  rows: SourceRow[];
  total: number;
  dims: Dim[];
  dim: string;
  onDim: (id: string) => void;
};

const fmt = new Intl.NumberFormat("en");

export function SourcesPanel({ rows, total, dims, dim, onDim }: SourcesPanelProps) {
  const visible = rows.slice(0, 6);
  const max = Math.max(1, ...visible.map((r) => r.count));

  return (
    <section className="flex h-[400px] flex-col overflow-hidden rounded-lg border border-trell-line bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-trell-line px-4">
        <span className="whitespace-nowrap py-3 text-sm font-medium text-trell-ink">
          <span className="border-b border-dotted border-neutral-300 pb-0.5">Sources</span>
        </span>
        <div className="flex min-w-0 items-center gap-3">
          <div className="scrollbar-hide flex items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-lg bg-neutral-100 p-0.5 dark:bg-white/10">
            {dims.map((d) => (
              <button
                key={d.id}
                onClick={() => onDim(d.id)}
                aria-pressed={dim === d.id}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  dim === d.id
                    ? "bg-white text-trell-ink shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <a href="#" className="shrink-0 text-xs font-medium text-neutral-400 transition-colors hover:text-trell-ink">
            View all &rarr;
          </a>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-trell-ink-muted">No data available</p>
        ) : (
          <div className="space-y-3.5">
            {visible.map((r) => (
              <div
                key={r.key}
                title={`${r.key}: ${fmt.format(r.count)} (${total ? ((r.count / total) * 100).toFixed(1) : "0.0"}%)`}
              >
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-neutral-600 dark:text-neutral-300">
                    {r.key}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-trell-ink">
                    {fmt.format(r.count)}
                  </span>
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                    {total ? ((r.count / total) * 100).toFixed(1) : "0.0"}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${r.count > 0 ? Math.max(2, (r.count / max) * 100) : 0}%`, background: "#2563eb" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
