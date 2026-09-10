"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { AskYoiButton } from "@/components/AskYoiButton";
import { EventBadge } from "@/components/EventBadge";
import { DateTimeField } from "@/components/DateTimeField";
import { useProjectId, useProjectEvents } from "@/lib/hooks";
import { localInput, fmtTime } from "@/lib/format";
import { eventLabel } from "@/lib/labels";

function exportEventsCSV(events: { type: string; formId: string | null; pagePath: string; deviceType: string; browser: string | null; os: string | null; ts: string; visitorId: string }[]) {
  const rows = [["Type", "Form", "Page", "Device", "Browser", "OS", "Time", "Visitor ID"]];
  for (const e of events) {
    rows.push([
      eventLabel(e.type),
      e.formId ?? "",
      e.pagePath,
      e.deviceType,
      e.browser ?? "",
      e.os ?? "",
      new Date(e.ts).toLocaleString(),
      e.visitorId,
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "form_view", label: "Views" },
  { value: "form_start", label: "Starts" },
  { value: "form_submit", label: "Submits" },
  { value: "form_success", label: "Conversions" },
  { value: "form_abandon", label: "Abandons" },
  { value: "cta_click", label: "Clicks" },
  { value: "field_interaction", label: "Fields" },
];

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function EventsPage() {
  const { projectId } = useProjectId();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [type, setType] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (type) p.set("type", type);
    return p.toString();
  }, [from, to, type]);

  const { data, isLoading } = useProjectEvents(projectId, qs, 50);
  const events = data?.events ?? [];

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <div>
          <h1 className="text-base font-semibold text-trell-ink">Events</h1>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => events.length > 0 && exportEventsCSV(events)}
          disabled={events.length === 0}
          className="trell-btn-outline h-9 gap-1.5 disabled:opacity-40"
        >
          <Icon name="download" size={16} />
          Export CSV
        </button>
        <AskYoiButton />
        </div>
      </header>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-trell-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">From</span>
            <DateTimeField value={from} onChange={setFrom} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">To</span>
            <DateTimeField value={to} onChange={setTo} />
          </label>
        </div>
        <div className="scrollbar-hide mt-3 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-lg bg-neutral-100 p-0.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                type === t.value
                  ? "bg-white text-trell-ink shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="trell-card max-h-[600px] overflow-auto p-4">
        <table className="trell-table w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-trell-line text-left text-xs text-trell-ink-muted">
              <th className="bg-white pb-2 font-medium">Type</th>
              <th className="bg-white pb-2 font-medium">Form</th>
              <th className="bg-white pb-2 font-medium">Page</th>
              <th className="bg-white pb-2 font-medium">Visitor</th>
              <th className="bg-white pb-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className="border-b border-trell-line transition-colors last:border-0 hover:bg-neutral-50">
                <td className="py-2"><EventBadge type={e.type} /></td>
                <td className="max-w-32 truncate py-2 font-medium text-trell-ink" title={e.formId ?? undefined}>{e.formId ?? <span className="font-normal text-neutral-300">–</span>}</td>
                <td className="max-w-48 truncate py-2 tabular-nums text-neutral-600" title={e.pagePath}>{e.pagePath}</td>
                <td className="py-2 font-mono text-xs text-neutral-400" title={e.visitorId}>{e.visitorId.slice(0, 8)}</td>
                <td className="whitespace-nowrap py-2 text-right tabular-nums text-neutral-500" title={fmtTime(e.ts)}>{ago(e.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && events.length === 0 && (
          <p className="py-6 text-center text-sm text-trell-ink-muted">Loading…</p>
        )}
        {!isLoading && events.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-trell-ink-muted">
              {type ? `No ${eventLabel(type).toLowerCase()} events in this range` : "No events yet"}
            </p>
            {type && (
              <button onClick={() => setType("")} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">
                Clear type filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
