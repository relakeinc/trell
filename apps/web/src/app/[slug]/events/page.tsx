"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { eventLabel } from "@/lib/labels";

interface DrillEvent {
  eventId: string;
  type: string;
  ts: string;
  pagePath: string;
  formId: string | null;
  formName: string | null;
  deviceType: string;
  browser: string | null;
  os: string | null;
  sessionId: string;
  visitorId: string;
  utmSource: string | null;
  utmMedium: string | null;
}

function exportEventsCSV(events: DrillEvent[]) {
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

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return ""; }
}

function localInput(d: Date): string {
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EventsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [events, setEvents] = useState<DrillEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const p = (d.projects ?? []).find((x: { slug: string }) => x.slug === slug);
        if (p) setProjectId(p.id);
      })
      .catch(() => {});
  }, [slug]);

  const fetchEvents = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const r = await fetch(`/api/projects/${projectId}/events?limit=50&${qs}`);
      if (r.ok) {
        const d = await r.json();
        setEvents(d.events ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId, from, to]);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

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

      <div className="trell-card p-4">
        <table className="w-full text-sm">
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
                <td className="py-2 text-trell-ink-default">{eventLabel(e.type)}</td>
                <td className="py-2 text-trell-ink-muted">{e.formId ?? "–"}</td>
                <td className="py-2 text-trell-ink-muted">{e.pagePath}</td>
                <td className="py-2 text-right text-trell-ink-muted">{fmtTime(e.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && events.length === 0 && (
          <p className="py-6 text-center text-sm text-trell-ink-muted">Loading…</p>
        )}
        {!loading && events.length === 0 && (
          <p className="py-6 text-center text-sm text-trell-ink-muted">No events yet</p>
        )}
      </div>
    </div>
  );
}
