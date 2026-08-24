"use client";

interface Event {
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

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export function DrilldownDrawer({
  title,
  events,
  total,
  nextCursor,
  loading,
  onLoadMore,
  onClose,
}: {
  title: string;
  events: Event[];
  total: number;
  nextCursor: string | null;
  loading: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex bg-black/30">
      <div className="ml-auto h-full w-full max-w-lg overflow-auto border-l border-trell-line bg-trell-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-trell-muted">{total} events</p>
          </div>
          <button onClick={onClose} className="text-trell-muted hover:text-trell-ink">✕</button>
        </div>
        <div className="mt-4 space-y-1">
          {events.map((e) => (
            <div key={e.eventId} className="rounded border border-trell-line px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.type}</span>
                <span className="text-trell-muted">{fmtTime(e.ts)}</span>
              </div>
              <div className="mt-1 text-trell-muted">
                {e.pagePath} · {e.deviceType}{e.browser ? ` · ${e.browser}` : ""}
                {e.formId ? ` · form ${e.formId}` : ""}
              </div>
              <div className="mt-0.5 text-[10px] text-trell-muted/70">
                session {e.sessionId.slice(0, 8)}… · visitor {e.visitorId.slice(0, 8)}…
                {e.utmSource ? ` · utm_source=${e.utmSource}` : ""}
              </div>
            </div>
          ))}
        </div>
        {events.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-trell-muted">No events match this filter.</p>
        )}
        {loading && <p className="py-4 text-center text-sm text-trell-muted">Loading…</p>}
        {nextCursor && !loading && (
          <button onClick={onLoadMore} className="trell-btn-outline mt-3 w-full h-8 text-xs">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
