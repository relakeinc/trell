import { z } from "zod";
import type { McpEvent, McpStore } from "../store";
import type { McpConfig } from "../config";
import { McpError, runTool } from "../errors";
import { resolveProject } from "../projects";
import { DAY_MS, resolveRange } from "./range";

export const INTERVALS = ["hour", "day", "week"] as const;
export type Interval = (typeof INTERVALS)[number];

export const DIMENSIONS = [
  "page",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "device",
  "browser",
  "os",
  "form",
  "type",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

const MAX_QUERY_LIMIT = 100;

function clampLimit(raw: number | undefined, def: number): number {
  if (raw === undefined) return def;
  if (!Number.isFinite(raw) || raw <= 0) return def;
  return Math.min(Math.floor(raw), MAX_QUERY_LIMIT);
}

function bucketKey(ts: Date, interval: Interval): string {
  if (interval === "hour") return `${ts.toISOString().slice(0, 13)}:00:00.000Z`;
  if (interval === "week") {
    const d = new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate()));
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
    return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
  }
  return `${ts.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function stepMs(interval: Interval): number {
  if (interval === "hour") return 3_600_000;
  if (interval === "week") return 7 * DAY_MS;
  return DAY_MS;
}

function dimensionValue(e: McpEvent, dimension: Dimension): string | null {
  switch (dimension) {
    case "page":
      return e.pagePath || null;
    case "utm_source":
      return e.utmSource;
    case "utm_medium":
      return e.utmMedium;
    case "utm_campaign":
      return e.utmCampaign;
    case "device":
      return e.deviceType || null;
    case "browser":
      return e.browser;
    case "os":
      return e.os;
    case "form":
      return e.formId;
    case "type":
      return e.type;
  }
}

function toIso(ts: Date): string {
  return ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
}

function mapEvent(e: McpEvent) {
  return {
    eventId: e.eventId,
    type: e.type,
    ts: toIso(e.ts),
    sessionId: e.sessionId,
    visitorId: e.visitorId,
    url: e.url,
    pagePath: e.pagePath,
    pageTitle: e.pageTitle,
    formId: e.formId,
    formName: e.formName,
  };
}

const rangeShape = {
  project: z.string().describe("Workspace slug or id"),
  from: z.string().optional().describe("ISO start date (default: 30 days ago)"),
  to: z.string().optional().describe("ISO end date (default: now)"),
};

export const getSeriesShape = {
  ...rangeShape,
  interval: z.enum(INTERVALS).default("day").describe("Bucket size"),
  type: z.array(z.string()).optional().describe("Filter by event types"),
  form: z.string().optional().describe("Filter by form id"),
};

export async function getSeries(
  store: McpStore,
  config: McpConfig,
  args: { project: string; interval?: Interval; from?: string; to?: string; type?: string[]; form?: string },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const interval: Interval = args.interval ?? "day";
    if (!INTERVALS.includes(interval))
      throw new McpError("invalid_input", `interval must be one of: ${INTERVALS.join(", ")}`);
    const { from, to } = resolveRange(args.from, args.to);
    const events = await store.getEventsForAnalytics(p.id, {
      from,
      to,
      ...(args.type && args.type.length > 0 ? { type: args.type } : {}),
      ...(args.form ? { form: args.form } : {}),
    });

    const counts = new Map<string, number>();
    for (const e of events) {
      const ts = e.ts instanceof Date ? e.ts : new Date(e.ts);
      const key = bucketKey(ts, interval);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Gap-fill so charts render continuous lines.
    const series: { bucket: string; count: number }[] = [];
    let cursor = new Date(bucketKey(from, interval));
    const end = new Date(bucketKey(to, interval)).getTime();
    for (let t = cursor.getTime(); t <= end; t += stepMs(interval)) {
      const key = new Date(t).toISOString();
      series.push({ bucket: key, count: counts.get(key) ?? 0 });
    }

    return { project: p.slug, interval, from: from.toISOString(), to: to.toISOString(), series };
  });
}

export const getBreakdownShape = {
  ...rangeShape,
  dimension: z.enum(DIMENSIONS).default("page").describe("Dimension to break down by"),
  type: z.array(z.string()).optional().describe("Filter by event types"),
  form: z.string().optional().describe("Filter by form id"),
  limit: z.number().optional().describe("Max rows (default 25, max 100)"),
};

export async function getBreakdown(
  store: McpStore,
  config: McpConfig,
  args: {
    project: string;
    dimension?: Dimension;
    from?: string;
    to?: string;
    type?: string[];
    form?: string;
    limit?: number;
  },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const dimension: Dimension = args.dimension ?? "page";
    if (!DIMENSIONS.includes(dimension)) {
      throw new McpError("invalid_input", `dimension must be one of: ${DIMENSIONS.join(", ")}`);
    }
    const { from, to } = resolveRange(args.from, args.to);
    const limit = clampLimit(args.limit, 25);
    const events = await store.getEventsForAnalytics(p.id, {
      from,
      to,
      ...(args.type && args.type.length > 0 ? { type: args.type } : {}),
      ...(args.form ? { form: args.form } : {}),
    });

    const counts = new Map<string, number>();
    for (const e of events) {
      const v = dimensionValue(e, dimension);
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));

    return { project: p.slug, dimension, from: from.toISOString(), to: to.toISOString(), rows };
  });
}

export const getFormsShape = {
  project: z.string().describe("Workspace slug or id"),
  from: z.string().optional().describe("ISO start date (default: 90 days ago)"),
  to: z.string().optional().describe("ISO end date (default: now)"),
};

export async function getForms(
  store: McpStore,
  config: McpConfig,
  args: { project: string; from?: string; to?: string },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    // Forms accumulate slowly — wider default window than event stats.
    const { from, to } = resolveRange(args.from, args.to, 90);
    const events = await store.getEventsForAnalytics(p.id, { from, to });

    const map = new Map<
      string,
      { id: string; name: string | null; events: number; starts: number; successes: number }
    >();
    for (const e of events) {
      if (!e.formId) continue;
      let row = map.get(e.formId);
      if (!row) {
        row = { id: e.formId, name: e.formName, events: 0, starts: 0, successes: 0 };
        map.set(e.formId, row);
      }
      row.events++;
      if (e.type === "form_start") row.starts++;
      if (e.type === "form_success") row.successes++;
    }
    const forms = [...map.values()]
      .sort((a, b) => b.events - a.events)
      // Completion = successes / starts (dashboard KPI definition).
      .map((r) => ({ ...r, conversionRate: r.starts > 0 ? r.successes / r.starts : null }));

    return { project: p.slug, from: from.toISOString(), to: to.toISOString(), forms };
  });
}

export const queryEventsShape = {
  ...rangeShape,
  type: z.array(z.string()).optional().describe("Filter by event types"),
  form: z.string().optional().describe("Filter by form id"),
  limit: z.number().optional().describe("Max events (default 25, max 100)"),
  cursor: z.string().optional().describe("eventId to continue after (pagination)"),
};

export async function queryEvents(
  store: McpStore,
  config: McpConfig,
  args: {
    project: string;
    from?: string;
    to?: string;
    type?: string[];
    form?: string;
    limit?: number;
    cursor?: string;
  },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const { from, to } = resolveRange(args.from, args.to);
    const limit = clampLimit(args.limit, 25);
    const events = await store.getEventsForAnalytics(p.id, {
      from,
      to,
      ...(args.type && args.type.length > 0 ? { type: args.type } : {}),
      ...(args.form ? { form: args.form } : {}),
    });
    // Oldest-first for cursor pagination (stores don't guarantee order).
    const ordered = [...events].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));

    let startIdx = 0;
    if (args.cursor) {
      const idx = ordered.findIndex((e) => e.eventId === args.cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const page = ordered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < ordered.length;
    // Cursor = oldest event of this page in oldest-first order (taken before reversing).
    const nextCursor = hasMore ? (ordered[startIdx + limit - 1]?.eventId ?? null) : null;

    return {
      project: p.slug,
      events: [...page].reverse().map(mapEvent),
      total: ordered.length,
      nextCursor,
    };
  });
}
