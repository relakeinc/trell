"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { EventBadge } from "@/components/EventBadge";
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

export default function EventsPage() {
  const { projectId } = useProjectId();
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));

  const qs = `from=${from}&to=${to}`;
  const { data, isLoading } = useProjectEvents(projectId, qs, 50);
  const events = data?.events ?? [];

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="text-base font-semibold text-trell-ink">Events</h1>
        <button
          onClick={() => events.length > 0 && exportEventsCSV(events)}
          disabled={events.length === 0}
          className="trell-btn-primary flex h-9 cursor-pointer items-center gap-1.5 disabled:opacity-40"
        >
          <Icon name="download" size={16} />
          Export CSV
        </button>
      </header>

      <div className="trell-card max-h-[600px] overflow-y-auto p-4">
        <table className="trell-table w-full text-sm">
          <thead>
            <tr className="border-b border-trell-line text-left text-xs text-trell-ink-muted">
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Form</th>
              <th className="pb-2 font-medium">Page</th>
              <th className="pb-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className="border-b border-trell-line last:border-0">
                <td className="py-2"><EventBadge type={e.type} /></td>
                <td className="py-2 text-trell-ink-muted">{e.formId ?? "\u2013"}</td>
                <td className="py-2 text-trell-ink-muted">{e.pagePath}</td>
                <td className="py-2 text-right text-trell-ink-muted">{fmtTime(e.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && events.length === 0 && (
          <p className="py-6 text-center text-sm text-trell-ink-muted">Loading…</p>
        )}
        {!isLoading && events.length === 0 && (
          <p className="py-6 text-center text-sm text-trell-ink-muted">No events yet</p>
        )}
      </div>
    </div>
  );
}
