/** Format a Date as a datetime-local input value. */
export function localInput(d: Date): string {
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Format a ratio (0–1) as a human-readable percentage string. */
export function pct(x: number | null): string {
  if (x == null) return "\u2013";
  return (x * 100).toFixed(x >= 0.1 ? 1 : 2) + "%";
}

/** Format milliseconds as a human-readable duration. */
export function humanMs(ms: number | null): string {
  if (ms == null) return "\u2013";
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + "s";
  const m = s / 60;
  return m < 60 ? m.toFixed(1) + "m" : (m / 60).toFixed(1) + "h";
}

/** Format an ISO timestamp as a short date + time. */
export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Format an ISO timestamp as a short date. */
export function fmtShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** Build query-string params from date range. */
export function rangeQs(from: string, to: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  return p.toString();
}
