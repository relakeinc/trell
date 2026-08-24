import type { StoredEvent } from "../repositories/types";

export type Interval = "hour" | "day" | "week";
export type Dimension = "page" | "utm_source" | "utm_medium" | "utm_campaign" | "device" | "browser" | "os" | "form" | "type";

export const DIMENSIONS: Dimension[] = ["page", "utm_source", "utm_medium", "utm_campaign", "device", "browser", "os", "form", "type"];
export const INTERVALS: Interval[] = ["hour", "day", "week"];

export interface MetricsSummary {
  events: number;
  views: number;
  starts: number;
  submits: number;
  successes: number;
  abandons: number;
  ctaClicks: number;
  fieldInteractions: number;
  sessions: number;
  visitors: number;
  /** successes / views — null when views === 0 */
  conversionRate: number | null;
  /** successes / starts — null when starts === 0 */
  startConversionRate: number | null;
  /** avg(success.ts - start.ts) per session+form, in ms — null when no matched pair */
  avgTimeToCompleteMs: number | null;
}

export interface TimelinePoint {
  bucket: number;
  date: string;
  views: number;
  starts: number;
  submits: number;
  successes: number;
  abandons: number;
  ctaClicks: number;
  fieldInteractions: number;
  sessions: number;
  visitors: number;
}

export interface BreakdownRow {
  key: string;
  count: number;
  percentage: number;
}

function bucketStart(ts: Date, interval: Interval): number {
  const d = ts;
  if (interval === "hour") {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
  }
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (interval === "day") return dayStart;
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  return dayStart - mondayOffset * 86_400_000;
}

export function computeMetrics(events: StoredEvent[]): MetricsSummary {
  const m: MetricsSummary = {
    events: 0,
    views: 0,
    starts: 0,
    submits: 0,
    successes: 0,
    abandons: 0,
    ctaClicks: 0,
    fieldInteractions: 0,
    sessions: 0,
    visitors: 0,
    conversionRate: null,
    startConversionRate: null,
    avgTimeToCompleteMs: null,
  };

  const sessions = new Set<string>();
  const visitors = new Set<string>();
  const timeGroups = new Map<string, { start?: number; success?: number }>();

  for (const e of events) {
    m.events++;
    sessions.add(e.sessionId);
    visitors.add(e.visitorId);

    switch (e.type) {
      case "form_view": m.views++; break;
      case "form_start": m.starts++; break;
      case "form_submit": m.submits++; break;
      case "form_success": m.successes++; break;
      case "form_abandon": m.abandons++; break;
      case "cta_click": m.ctaClicks++; break;
      case "field_interaction": m.fieldInteractions++; break;
      default: break;
    }

    if (e.type === "form_start" || e.type === "form_success") {
      const key = `${e.sessionId}|${e.formId ?? ""}`;
      let g = timeGroups.get(key);
      if (!g) {
        g = {};
        timeGroups.set(key, g);
      }
      const t = e.ts.getTime();
      if (e.type === "form_start") g.start = g.start == null ? t : Math.min(g.start, t);
      else g.success = g.success == null ? t : Math.min(g.success, t);
    }
  }

  m.sessions = sessions.size;
  m.visitors = visitors.size;
  m.conversionRate = m.views > 0 ? m.successes / m.views : null;
  m.startConversionRate = m.starts > 0 ? m.successes / m.starts : null;

  let sum = 0;
  let count = 0;
  for (const g of timeGroups.values()) {
    if (g.start != null && g.success != null) {
      sum += g.success - g.start;
      count++;
    }
  }
  m.avgTimeToCompleteMs = count > 0 ? sum / count : null;

  return m;
}

export function computeSeries(events: StoredEvent[], interval: Interval): TimelinePoint[] {
  const map = new Map<number, TimelinePoint & { s?: Set<string>; v?: Set<string> }>();

  for (const e of events) {
    const bucket = bucketStart(e.ts, interval);
    let p = map.get(bucket);
    if (!p) {
      p = {
        bucket,
        date: new Date(bucket).toISOString(),
        views: 0, starts: 0, submits: 0, successes: 0, abandons: 0, ctaClicks: 0, fieldInteractions: 0,
        sessions: 0, visitors: 0,
        s: new Set(),
        v: new Set(),
      };
      map.set(bucket, p);
    }
    p.s!.add(e.sessionId);
    p.v!.add(e.visitorId);

    switch (e.type) {
      case "form_view": p.views++; break;
      case "form_start": p.starts++; break;
      case "form_submit": p.submits++; break;
      case "form_success": p.successes++; break;
      case "form_abandon": p.abandons++; break;
      case "cta_click": p.ctaClicks++; break;
      case "field_interaction": p.fieldInteractions++; break;
      default: break;
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => ({
      bucket: p.bucket,
      date: p.date,
      views: p.views,
      starts: p.starts,
      submits: p.submits,
      successes: p.successes,
      abandons: p.abandons,
      ctaClicks: p.ctaClicks,
      fieldInteractions: p.fieldInteractions,
      sessions: p.s!.size,
      visitors: p.v!.size,
    }));
}

const accessors: Record<Dimension, (e: StoredEvent) => string | null> = {
  page: (e) => (e.pagePath ? e.pagePath : null),
  utm_source: (e) => e.utmSource,
  utm_medium: (e) => e.utmMedium,
  utm_campaign: (e) => e.utmCampaign,
  device: (e) => e.deviceType,
  browser: (e) => e.browser,
  os: (e) => e.os,
  form: (e) => e.formId,
  type: (e) => e.type,
};

export function computeBreakdown(events: StoredEvent[], dimension: Dimension, topN = 25): BreakdownRow[] {
  const counts = new Map<string, number>();
  const accessor = accessors[dimension];

  for (const e of events) {
    const raw = accessor(e);
    const key = raw && raw.length > 0 ? raw : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = events.length || 1;
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count, percentage: count / total }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, topN);
}

export function buildFilter(query: { from?: string; to?: string; type?: string; form?: string }): { from?: Date; to?: Date; type?: string[]; form?: string } {
  const filter: { from?: Date; to?: Date; type?: string[]; form?: string } = {};
  if (query.from) {
    const d = new Date(query.from);
    if (!Number.isNaN(d.getTime())) filter.from = d;
  }
  if (query.to) {
    const d = new Date(query.to);
    if (!Number.isNaN(d.getTime())) filter.to = d;
  }
  if (query.type) {
    const types = query.type.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length) filter.type = types;
  }
  if (query.form) filter.form = query.form;
  return filter;
}
