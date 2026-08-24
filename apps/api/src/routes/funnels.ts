import type { Context } from "hono";
import type { Repo } from "../repositories/types";
import { sendOk, badRequest, sendError } from "../lib/errors";
import { computeFunnel, computeFunnelHybrid, FunnelTooLargeError } from "../analytics/funnel";
import { getSessionSegment } from "../analytics/segmentation";
import { buildFilter } from "../analytics/metrics";

export function makeFunnels(repo: Repo) {
  return {
    list: async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const funnels = await repo.listFunnels(projectId);
      return sendOk(c, 200, { funnels });
    },

    create: async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const body = await c.req.json<{ name?: string; steps?: { eventType: string; formId?: string; label?: string; position: number }[] }>();
      if (!body.name || !body.steps || body.steps.length === 0) {
        return badRequest(c, "name and at least one step required", "invalid_body");
      }
      const funnel = await repo.createFunnel({
        projectId,
        name: body.name,
        steps: body.steps.map((s, i) => ({
          eventType: s.eventType,
          formId: s.formId,
          label: s.label,
          position: s.position ?? i,
        })),
      });
      return sendOk(c, 201, { funnel });
    },

    get: async (c: Context): Promise<Response> => {
      const funnelId = c.req.param("fid") ?? "";
      if (!funnelId) return badRequest(c, "funnel id required", "missing_fid");
      const funnel = await repo.getFunnel(funnelId);
      if (!funnel) return sendError(c, 404, "not_found", "funnel not found");
      return sendOk(c, 200, { funnel });
    },

    update: async (c: Context): Promise<Response> => {
      const funnelId = c.req.param("fid") ?? "";
      if (!funnelId) return badRequest(c, "funnel id required", "missing_fid");
      const existing = await repo.getFunnel(funnelId);
      if (!existing) return sendError(c, 404, "not_found", "funnel not found");

      const body = await c.req.json<{ name?: string; steps?: { eventType: string; formId?: string; label?: string; position: number }[] }>();
      const funnel = await repo.updateFunnel(funnelId, {
        name: body.name,
        steps: body.steps?.map((s, i) => ({
          eventType: s.eventType,
          formId: s.formId,
          label: s.label,
          position: s.position ?? i,
        })),
      });
      return sendOk(c, 200, { funnel });
    },

    remove: async (c: Context): Promise<Response> => {
      const funnelId = c.req.param("fid") ?? "";
      if (!funnelId) return badRequest(c, "funnel id required", "missing_fid");
      const existing = await repo.getFunnel(funnelId);
      if (!existing) return sendError(c, 404, "not_found", "funnel not found");
      await repo.deleteFunnel(funnelId);
      return sendOk(c, 200, { deleted: true });
    },

    compute: async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const body = await c.req.json<{ steps: { eventType: string; formId?: string; label?: string; position: number }[] }>();
      if (!body.steps || body.steps.length === 0) {
        return badRequest(c, "at least one step required", "invalid_body");
      }

      const filter = buildFilter({
        from: c.req.query("from"),
        to: c.req.query("to"),
      });

      const segmentRaw = c.req.query("segment");
      let segment: Record<string, string> | undefined;
      if (segmentRaw) {
        try { segment = JSON.parse(segmentRaw); } catch { /* ignore */ }
      }

      let events = await repo.getEventsForAnalytics(projectId, filter);
      if (segment) {
        const qualified = getSessionSegment(events, segment);
        events = events.filter((e) => qualified.has(e.sessionId));
      }

      const steps = body.steps.map((s, i) => ({
        id: `tmp_${i}`,
        funnelId: "tmp",
        eventType: s.eventType,
        formId: s.formId ?? null,
        label: s.label ?? null,
        position: s.position ?? i,
      }));

      try {
        const result = await computeFunnelHybrid(null, projectId, { id: "tmp", projectId, name: "adhoc", steps, createdAt: new Date(), updatedAt: new Date() }, events, filter);
        return sendOk(c, 200, result);
      } catch (e) {
        if (e instanceof FunnelTooLargeError) {
          return sendError(c, 413, "funnel_too_large", e.message);
        }
        throw e;
      }
    },
  };
}
