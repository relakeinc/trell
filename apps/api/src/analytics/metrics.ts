import type { StoredEvent } from "../repositories/types";

export type Interval = "hour" | "day" | "week";
export type Dimension =
  "page" | "utm_source" | "utm_medium" | "utm_campaign" | "device" | "browser" | "os" | "form" | "type";

export const DIMENSIONS: Dimension[] = [
  "page",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "device",
  "browser",
  "os",
  "form",
  "type",
];
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
  /** sessions with only 1 pageview / total sessions */
  bounceRate: number | null;
  /** total pageviews / total sessions */
  pagesPerSession: number | null;
  /** avg scroll depth from scroll_depth events, 0-100 */
  avgScrollDepth: number | null;
  /** avg time on page from page_exit events, in ms */
  avgTimeOnPageMs: number | null;
  /** avg focus → first change per field from field_interaction.hesitationMs, in ms */
  avgHesitationMs: number | null;
  /** avg time between consecutive field interactions from field_interaction.gapMs, in ms */
  avgInteractionGapMs: number | null;
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

function parseProps(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
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
    bounceRate: null,
    pagesPerSession: null,
    avgScrollDepth: null,
    avgTimeOnPageMs: null,
    avgHesitationMs: null,
    avgInteractionGapMs: null,
  };

  const sessions = new Set<string>();
  const visitors = new Set<string>();
  const timeGroups = new Map<string, { start?: number; success?: number }>();
  const pageviewCounts = new Map<string, number>(); // sessionId → pageview count
  const scrollMaxByPage = new Map<string, number>(); // sessionId|pagePath → max depth
  const pageExitDurations: number[] = [];
  const hesitations: number[] = [];
  const gaps: number[] = [];

  for (const e of events) {
    m.events++;
    sessions.add(e.sessionId);
    visitors.add(e.visitorId);

    switch (e.type) {
      case "form_view":
        m.views++;
        break;
      case "form_start":
        m.starts++;
        break;
      case "form_submit":
        m.submits++;
        break;
      case "form_success":
        m.successes++;
        break;
      case "form_abandon":
        m.abandons++;
        break;
      case "cta_click":
        m.ctaClicks++;
        break;
      case "field_interaction": {
        m.fieldInteractions++;
        const props = parseProps(e.properties);
        const hesitation = props?.hesitationMs;
        if (typeof hesitation === "number" && hesitation >= 0) hesitations.push(hesitation);
        const gap = props?.gapMs;
        if (typeof gap === "number" && gap >= 0) gaps.push(gap);
        break;
      }
      case "scroll_depth": {
        // Milestones fire per page: keep max per session+page so avg reflects deepest reach.
        const props = parseProps(e.properties);
        const depth = props?.depth;
        const maxDepth = props?.maxDepth;
        const best = Math.max(typeof depth === "number" ? depth : 0, typeof maxDepth === "number" ? maxDepth : 0);
        if (best > 0) {
          const key = `${e.sessionId}|${e.pagePath}`;
          scrollMaxByPage.set(key, Math.max(scrollMaxByPage.get(key) ?? 0, best));
        }
        break;
      }
      case "page_exit": {
        const dur = parseProps(e.properties)?.durationMs;
        if (typeof dur === "number") pageExitDurations.push(dur);
        break;
      }
      case "pageview": {
        const prev = pageviewCounts.get(e.sessionId) || 0;
        pageviewCounts.set(e.sessionId, prev + 1);
        break;
      }
      default:
        break;
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
      // Latest success pairs earliest start with completion even out of order; never negative.
      else g.success = g.success == null ? t : Math.max(g.success, t);
    }
  }

  m.sessions = sessions.size;
  m.visitors = visitors.size;
  m.conversionRate = m.views > 0 ? m.successes / m.views : null;
  m.startConversionRate = m.starts > 0 ? m.successes / m.starts : null;

  let sum = 0;
  let count = 0;
  for (const g of timeGroups.values()) {
    if (g.start != null && g.success != null && g.success >= g.start) {
      sum += g.success - g.start;
      count++;
    }
  }
  m.avgTimeToCompleteMs = count > 0 ? sum / count : null;

  // Bounce rate: ≤1-pageview sessions over sessions WITH pageviews (others can't bounce).
  let bounceCount = 0;
  for (const pvCount of pageviewCounts.values()) {
    if (pvCount <= 1) bounceCount++;
  }
  const sessionsWithPageviews = pageviewCounts.size;
  m.bounceRate = sessionsWithPageviews > 0 ? bounceCount / sessionsWithPageviews : null;

  let totalPageviews = 0;
  for (const pvCount of pageviewCounts.values()) {
    totalPageviews += pvCount;
  }
  m.pagesPerSession = sessions.size > 0 ? totalPageviews / sessions.size : null;

  if (scrollMaxByPage.size > 0) {
    let depthSum = 0;
    for (const d of scrollMaxByPage.values()) depthSum += d;
    m.avgScrollDepth = depthSum / scrollMaxByPage.size;
  }

  if (pageExitDurations.length > 0) {
    m.avgTimeOnPageMs = pageExitDurations.reduce((a, b) => a + b, 0) / pageExitDurations.length;
  }

  if (hesitations.length > 0) {
    m.avgHesitationMs = hesitations.reduce((a, b) => a + b, 0) / hesitations.length;
  }
  if (gaps.length > 0) {
    m.avgInteractionGapMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  return m;
}

export interface SeriesRange {
  from?: Date;
  to?: Date;
}

/** Max buckets generated when zero-filling (protects against hour × year ranges). */
const MAX_FILL_BUCKETS = 1000;

const INTERVAL_MS: Record<Interval, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
};

function emptyPoint(bucket: number): TimelinePoint & { s: Set<string>; v: Set<string> } {
  return {
    bucket,
    date: new Date(bucket).toISOString(),
    views: 0,
    starts: 0,
    submits: 0,
    successes: 0,
    abandons: 0,
    ctaClicks: 0,
    fieldInteractions: 0,
    sessions: 0,
    visitors: 0,
    s: new Set(),
    v: new Set(),
  };
}

export function computeSeries(events: StoredEvent[], interval: Interval, range?: SeriesRange): TimelinePoint[] {
  const map = new Map<number, TimelinePoint & { s: Set<string>; v: Set<string> }>();

  for (const e of events) {
    const bucket = bucketStart(e.ts, interval);
    let p = map.get(bucket);
    if (!p) {
      p = emptyPoint(bucket);
      map.set(bucket, p);
    }
    p.s.add(e.sessionId);
    p.v.add(e.visitorId);

    switch (e.type) {
      case "form_view":
        p.views++;
        break;
      case "form_start":
        p.starts++;
        break;
      case "form_submit":
        p.submits++;
        break;
      case "form_success":
        p.successes++;
        break;
      case "form_abandon":
        p.abandons++;
        break;
      case "cta_click":
        p.ctaClicks++;
        break;
      case "field_interaction":
        p.fieldInteractions++;
        break;
      default:
        break;
    }
  }

  // Zero-fill range so charts render the full period, not just buckets with events.
  if (range?.from && range?.to && range.to.getTime() > range.from.getTime()) {
    const stepMs = INTERVAL_MS[interval];
    let t = bucketStart(range.from, interval);
    const end = range.to.getTime();
    for (let count = 0; t <= end && count < MAX_FILL_BUCKETS; t += stepMs, count++) {
      if (!map.has(t)) map.set(t, emptyPoint(t));
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => stripSeriesPoint(p));
}

function stripSeriesPoint(p: TimelinePoint & { s?: Set<string>; v?: Set<string> }): TimelinePoint {
  return {
    bucket: p.bucket,
    date: p.date,
    views: p.views,
    starts: p.starts,
    submits: p.submits,
    successes: p.successes,
    abandons: p.abandons,
    ctaClicks: p.ctaClicks,
    fieldInteractions: p.fieldInteractions,
    sessions: p.s?.size ?? p.sessions,
    visitors: p.v?.size ?? p.visitors,
  };
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
  const isUtm = dimension.startsWith("utm_");

  for (const e of events) {
    const raw = accessor(e);
    // For UTM dimensions, skip events that don't have that UTM set
    if (isUtm && (!raw || raw.length === 0)) continue;
    const key = raw && raw.length > 0 ? raw : "(none)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count, percentage: count / total }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, topN);
}

export function buildFilter(query: { from?: string; to?: string; type?: string; form?: string }): {
  from?: Date;
  to?: Date;
  type?: string[];
  form?: string;
} {
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
    const types = query.type
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length) filter.type = types;
  }
  if (query.form) filter.form = query.form;
  return filter;
}
