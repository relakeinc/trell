"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type EventsFeedEvent = {
  type: string;
  formId: string | null;
  formName: string | null;
  pagePath: string;
  ts: string;
};

type EventsFeedProps = {
  events: EventsFeedEvent[];
  slug: string;
};

const TYPE_META: Record<string, { label: string; dot: string }> = {
  form_view: { label: "Form view", dot: "bg-blue-400" },
  form_start: { label: "Form start", dot: "bg-indigo-400" },
  form_interaction: { label: "Form interaction", dot: "bg-cyan-400" },
  field_interaction: { label: "Form interaction", dot: "bg-cyan-400" },
  form_submit: { label: "Form submit", dot: "bg-amber-400" },
  form_success: { label: "Form success", dot: "bg-emerald-400" },
  form_abandon: { label: "Form abandon", dot: "bg-red-400" },
  cta_click: { label: "CTA click", dot: "bg-violet-400" },
  pageview: { label: "Page view", dot: "bg-slate-400" },
  scroll_depth: { label: "Scroll depth", dot: "bg-teal-400" },
  page_exit: { label: "Page exit", dot: "bg-orange-400" },
};

const FORM_TYPES = new Set([
  "form_view",
  "form_start",
  "form_interaction",
  "field_interaction",
  "form_submit",
  "form_success",
  "form_abandon",
]);

function prettyRawType(type: string): string {
  const words = type.replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return type;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function typeMeta(type: string): { label: string; dot: string } {
  return TYPE_META[type] ?? { label: prettyRawType(type), dot: "bg-neutral-400" };
}

export function displayName(e: EventsFeedEvent): string | null {
  const formName = e.formName?.trim();
  if (formName) return formName;
  const formId = e.formId?.trim();
  const pagePath = e.pagePath?.trim();
  if (FORM_TYPES.has(e.type)) {
    if (formId) return formId;
    if (pagePath) return pagePath;
    return null;
  }
  if (pagePath) return pagePath;
  if (formId) return formId;
  return null;
}

function formatRelative(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = now - t;
  if (diffMs < 60_000) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function EventsFeed({ events, slug }: EventsFeedProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const visible = events.slice(0, 8);

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-trell-line bg-white dark:border-white/10 dark:bg-neutral-900">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-trell-line px-4 dark:border-white/10">
        <span className="whitespace-nowrap py-3 text-sm font-medium text-trell-ink">
          <span className="border-b border-dotted border-neutral-300 pb-0.5 dark:border-white/20">Recent events</span>
        </span>
        <Link
          href={`/${slug}/events`}
          className="shrink-0 text-xs font-medium text-neutral-400 transition-colors hover:text-trell-ink dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          View all &rarr;
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-trell-ink-muted">No data available</p>
        ) : (
          <ul className="divide-y divide-trell-line dark:divide-white/10">
            {visible.map((e, i) => {
              const meta = typeMeta(e.type);
              const name = displayName(e);
              return (
                <li key={`${e.ts}-${e.type}-${i}`} className="flex items-center gap-3 px-2 py-2.5" title={e.ts}>
                  <div className="min-w-0 flex-1">
                    {name ? (
                      <p className="truncate text-[13px] font-medium leading-5 text-trell-ink">{name}</p>
                    ) : (
                      <p className="truncate text-[13px] leading-5 text-neutral-300 dark:text-neutral-600">—</p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs leading-4 text-trell-ink-muted">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                      <span className="truncate">{meta.label}</span>
                    </p>
                  </div>
                  <time className="shrink-0 whitespace-nowrap text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                    {formatRelative(e.ts, now)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
