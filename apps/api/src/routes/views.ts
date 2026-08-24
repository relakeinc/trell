import type { Context } from "hono";
import type { Repo } from "../repositories/types";
import { sendOk, badRequest, sendError } from "../lib/errors";
import { validateSavedViewConfig } from "../analytics/schemas";

export function makeViews(repo: Repo) {
  return {
    list: async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const views = await repo.listSavedViews(projectId);
      return sendOk(c, 200, { views });
    },

    create: async (c: Context): Promise<Response> => {
      const projectId = c.get("projectId");
      const body = await c.req.json<{ name?: string; type?: string; config?: unknown }>();
      if (!body.name || !body.type || !body.config) {
        return badRequest(c, "name, type, and config required", "invalid_body");
      }

      // Validate config via Zod discriminated union
      let validated;
      try {
        validated = validateSavedViewConfig(body.type, body.config);
      } catch (e) {
        return badRequest(c, `invalid config for type "${body.type}": ${e instanceof Error ? e.message : String(e)}`, "invalid_config");
      }

      const view = await repo.createSavedView({
        projectId,
        name: body.name,
        type: body.type,
        config: JSON.stringify(validated),
      });
      return sendOk(c, 201, { view });
    },

    remove: async (c: Context): Promise<Response> => {
      const viewId = c.req.param("vid") ?? "";
      if (!viewId) return badRequest(c, "view id required", "missing_vid");
      const existing = await repo.getSavedView(viewId);
      if (!existing) return sendError(c, 404, "not_found", "view not found");
      await repo.deleteSavedView(viewId);
      return sendOk(c, 200, { deleted: true });
    },
  };
}
