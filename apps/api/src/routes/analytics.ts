import type { Context } from "hono";
import type { Repo } from "../repositories/types";
import { sendOk, badRequest } from "../lib/errors";
import { buildFilter, computeBreakdown, computeMetrics, computeSeries, DIMENSIONS, INTERVALS, type Dimension, type Interval } from "../analytics/metrics";
import { filterEvents, getSessionSegment } from "../analytics/segmentation";
import { computeFunnel } from "../analytics/funnel";
import { computeMetricsComparison } from "../analytics/comparison";

class BadQuery extends Error {}

function parseDateQuery(raw: string | undefined, name: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadQuery(`invalid ${name}: ${raw}`);
  return d;
}

function intQuery(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseSegment(c: Context): Record<string, string> | undefined {
  const seg: Record<string, string> = {};
  const page = c.req.query("page");
  const device = c.req.query("device");
  const browser = c.req.query("browser");
  const os = c.req.query("os");
  const utmSource = c.req.query("utmSource");
  const utmMedium = c.req.query("utmMedium");
  const utmCampaign = c.req.query("utmCampaign");
  if (page) seg.page = page;
  if (device) seg.device = device;
  if (browser) seg.browser = browser;
  if (os) seg.os = os;
  if (utmSource) seg.utmSource = utmSource;
  if (utmMedium) seg.utmMedium = utmMedium;
  if (utmCampaign) seg.utmCampaign = utmCampaign;
  return Object.keys(seg).length > 0 ? seg : undefined;
}

type Handler = (c: Context) => Promise<Response>;

function guard(fn: Handler): Handler {
  return async (c) => {
    try {
      return await fn(c);
    } catch (e) {
      if (e instanceof BadQuery) return badRequest(c, e.message, "invalid_query");
      throw e;
    }
  };
}

export function makeAnalytics(repo: Repo) {
  return {
    stats: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const filter = buildFilter({
        from: c.req.query("from"),
        to: c.req.query("to"),
        type: c.req.query("type"),
        form: c.req.query("form"),
      });
      const segment = parseSegment(c);
      let events = await repo.getEventsForAnalytics(projectId, filter);
      if (segment) events = filterEvents(events, segment);

      const compareFrom = parseDateQuery(c.req.query("compareFrom"), "compareFrom");
      const compareTo = parseDateQuery(c.req.query("compareTo"), "compareTo");

      const result: Record<string, unknown> = {
        projectId,
        metrics: computeMetrics(events),
        filters: { from: filter.from ?? null, to: filter.to ?? null, type: filter.type ?? null, form: filter.form ?? null, segment: segment ?? null },
      };

      if (compareFrom && compareTo) {
        const compareFilter = { ...filter, from: compareFrom, to: compareTo };
        let compareEvents = await repo.getEventsForAnalytics(projectId, compareFilter);
        if (segment) compareEvents = filterEvents(compareEvents, segment);
        result.comparison = computeMetricsComparison(events, compareEvents);
      }

      return sendOk(c, 200, result);
    }),

    series: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const intervalRaw = c.req.query("interval") ?? "day";
      if (!INTERVALS.includes(intervalRaw as Interval)) return badRequest(c, `invalid interval: ${intervalRaw}`, "invalid_interval");
      const interval = intervalRaw as Interval;

      const from = parseDateQuery(c.req.query("from"), "from");
      const to = parseDateQuery(c.req.query("to"), "to");
      const type = c.req.query("type");
      const form = c.req.query("form");
      const segment = parseSegment(c);

      const events = await repo.getEventsForAnalytics(projectId, { from, to, type: type?.split(",").filter(Boolean), form });
      const filtered = segment ? filterEvents(events, segment) : events;
      return sendOk(c, 200, { interval, series: computeSeries(filtered, interval) });
    }),

    breakdown: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const dimRaw = c.req.query("dimension") ?? "page";
      if (!DIMENSIONS.includes(dimRaw as Dimension)) return badRequest(c, `invalid dimension: ${dimRaw}`, "invalid_dimension");
      const dimension = dimRaw as Dimension;

      const from = parseDateQuery(c.req.query("from"), "from");
      const to = parseDateQuery(c.req.query("to"), "to");
      const type = c.req.query("type");
      const topN = intQuery(c.req.query("limit"), 25);
      const form = c.req.query("form");
      const segment = parseSegment(c);

      const events = await repo.getEventsForAnalytics(projectId, { from, to, type: type?.split(",").filter(Boolean), form });
      const filtered = segment ? filterEvents(events, segment) : events;
      return sendOk(c, 200, { dimension, rows: computeBreakdown(filtered, dimension, topN) });
    }),

    forms: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const events = await repo.getEventsForAnalytics(projectId, {});
      const map = new Map<string, { id: string; name: string | null; events: number; successes: number }>();
      for (const e of events) {
        if (!e.formId) continue;
        let row = map.get(e.formId);
        if (!row) {
          row = { id: e.formId, name: e.formName, events: 0, successes: 0 };
          map.set(e.formId, row);
        }
        row.events++;
        if (e.type === "form_success") row.successes++;
      }
      const rows = Array.from(map.values())
        .sort((a, b) => b.events - a.events)
        .map((r) => ({ ...r, conversionRate: r.events > 0 ? r.successes / r.events : null }));
      return sendOk(c, 200, { forms: rows });
    }),

    events: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const from = parseDateQuery(c.req.query("from"), "from");
      const to = parseDateQuery(c.req.query("to"), "to");
      const type = c.req.query("type");
      const limit = intQuery(c.req.query("limit"), 100);
      const form = c.req.query("form");
      const segment = parseSegment(c);
      const funnelId = c.req.query("funnelId");

      let events = await repo.getEventsForAnalytics(projectId, { from, to, type: type?.split(",").filter(Boolean), form });

      // Session segment for funnel drill-down
      if (funnelId) {
        const funnel = await repo.getFunnel(funnelId);
        if (funnel) {
          const qualified = getSessionSegment(events, segment);
          events = events.filter((e) => qualified.has(e.sessionId));
        }
      } else if (segment) {
        events = filterEvents(events, segment);
      }

      // Pagination via cursor (event id)
      const cursor = c.req.query("cursor");
      let startIdx = 0;
      if (cursor) {
        const idx = events.findIndex((e) => e.eventId === cursor);
        if (idx >= 0) startIdx = idx + 1;
      }

      const page = events.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + limit < events.length;
      const nextCursor = hasMore ? page[page.length - 1]?.eventId : null;

      return sendOk(c, 200, {
        events: page.reverse(),
        total: events.length,
        nextCursor,
      });
    }),

    funnelLive: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const funnelId = c.req.query("funnelId");
      if (!funnelId) return badRequest(c, "funnelId is required", "missing_funnel_id");

      const funnel = await repo.getFunnel(funnelId);
      if (!funnel) return badRequest(c, "funnel not found", "funnel_not_found");

      const filter = buildFilter({
        from: c.req.query("from"),
        to: c.req.query("to"),
      });
      const segment = parseSegment(c);

      let events = await repo.getEventsForAnalytics(projectId, filter);
      if (segment) {
        const qualified = getSessionSegment(events, segment);
        events = events.filter((e) => qualified.has(e.sessionId));
      }

      const result = computeFunnel(events, funnel.steps);
      return sendOk(c, 200, { funnel: { id: funnel.id, name: funnel.name }, ...result });
    }),

    realtime: guard(async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const now = Date.now();
      const thirtySecAgo = new Date(now - 30_000);
      const filter = { from: thirtySecAgo, to: new Date(now) };
      const events = await repo.getEventsForAnalytics(projectId, filter);

      // Group by type
      const byType: Record<string, number> = {};
      const recent = events.slice(-10).reverse().map((e) => ({
        type: e.type,
        page: e.page,
        ts: e.ts.toISOString(),
      }));

      for (const e of events) {
        byType[e.type] = (byType[e.type] || 0) + 1;
      }

      return sendOk(c, 200, {
        count: events.length,
        byType,
        recent,
      });
    }),
  };
}
