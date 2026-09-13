import { eventLabel } from "@/lib/labels";

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pageview: {
    bg: "bg-slate-100 dark:bg-slate-500/15",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  form_view: { bg: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-400" },
  form_start: {
    bg: "bg-indigo-50 dark:bg-indigo-500/15",
    text: "text-indigo-700 dark:text-indigo-400",
    dot: "bg-indigo-400",
  },
  form_submit: {
    bg: "bg-amber-50 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  form_success: {
    bg: "bg-emerald-50 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  form_abandon: { bg: "bg-red-50 dark:bg-red-500/15", text: "text-red-600 dark:text-red-400", dot: "bg-red-400" },
  cta_click: {
    bg: "bg-violet-50 dark:bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-400",
    dot: "bg-violet-400",
  },
  field_interaction: {
    bg: "bg-cyan-50 dark:bg-cyan-500/15",
    text: "text-cyan-700 dark:text-cyan-400",
    dot: "bg-cyan-400",
  },
};

const DEFAULT_COLOR = {
  bg: "bg-neutral-100 dark:bg-white/10",
  text: "text-neutral-600 dark:text-neutral-300",
  dot: "bg-neutral-400",
};

export function EventBadge({ type }: { type: string }) {
  const c = EVENT_COLORS[type] ?? DEFAULT_COLOR;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {eventLabel(type)}
    </span>
  );
}
