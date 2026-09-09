"use client";

type RankedForm = {
  id: string;
  name: string | null;
  events: number;
  conversionRate: number | null;
};

type FormsRankingProps = {
  forms: RankedForm[];
  slug: string;
};

const fmt = new Intl.NumberFormat("en");

export function FormsRanking({ forms, slug }: FormsRankingProps) {
  const visible = forms.slice(0, 8);

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-trell-line bg-white dark:border-white/10 dark:bg-neutral-900">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-trell-line px-4 dark:border-white/10">
        <span className="whitespace-nowrap py-3 text-sm font-medium text-trell-ink">
          <span className="border-b border-dotted border-neutral-300 pb-0.5 dark:border-white/20">
            Forms
          </span>
        </span>
        <a
          href={`/${slug}/submissions`}
          className="shrink-0 text-xs font-medium text-neutral-400 transition-colors hover:text-trell-ink dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          View all &rarr;
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-trell-ink-muted">No data available</p>
        ) : (
          <ul className="divide-y divide-trell-line dark:divide-white/10">
            {visible.map((f) => {
              const hasCompletion = f.conversionRate != null && f.events > 0;
              const name = f.name?.trim() || f.id;
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 px-2 py-2.5"
                  title={f.name ?? f.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-5 text-trell-ink">
                      {name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs leading-4 text-trell-ink-muted">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      <span className="truncate">
                        {f.name?.trim() ? f.id : "form"} &middot;{" "}
                        {hasCompletion ? `${(f.conversionRate! * 100).toFixed(1)}% completion` : "— completion"}
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                    {fmt.format(f.events)} {f.events === 1 ? "view" : "views"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
