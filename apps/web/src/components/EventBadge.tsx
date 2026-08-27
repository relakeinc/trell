import { eventLabel } from "@/lib/labels";

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pageview: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  form_view: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  form_start: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  form_submit: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  form_success: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  form_abandon: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
  cta_click: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-400" },
  field_interaction: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-400" },
};

const DEFAULT_COLOR = { bg: "bg-neutral-100", text: "text-neutral-600", dot: "bg-neutral-400" };

export function EventBadge({ type }: { type: string }) {
  const c = EVENT_COLORS[type] ?? DEFAULT_COLOR;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {eventLabel(type)}
    </span>
  );
}
