import type { Context } from "hono";
import { z } from "zod";
import type { Repo } from "../repositories/types";
import type { ApiConfig } from "../config";
import { newApiKeys } from "../lib/crypto";
import { badRequest, sendError, sendOk } from "../lib/errors";

const bodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  organizationName: z.string().min(1).optional(),
  domains: z.array(z.string()).or(z.string()).optional(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeProjects(repo: Repo, config: ApiConfig) {
  return {
    handler: async (c: Context): Promise<Response> => {
      if (!config.adminKey) return sendError(c, 503, "admin_not_configured", "TRELL_ADMIN_KEY is not set");

      const header = c.req.header("authorization") ?? "";
      const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
      if (!key || key !== config.adminKey) return sendError(c, 401, "unauthorized", "invalid admin key");

      let parsed: z.infer<typeof bodySchema>;
      try {
        parsed = bodySchema.parse(await c.req.json());
      } catch {
        return badRequest(c, "invalid request body", "invalid_request");
      }

      const slug = parsed.slug ?? slugify(parsed.name);
      const domains = Array.isArray(parsed.domains) ? parsed.domains.join(",") : parsed.domains ?? "";

      const { pk, sk, skHash } = newApiKeys(config.pkPrefix, config.skPrefix);

      const project = await repo.createOrganizationAndProject({
        name: parsed.name,
        slug,
        organizationName: parsed.organizationName ?? parsed.name,
        pk,
        skHash,
        domains,
      });

      return sendOk(c, 201, {
        project: { id: project.id, name: project.name, slug: project.slug, domains: project.domains },
        keys: { pk, sk }, // sk is shown exactly once — only the hash is stored
      });
    },
  };
}
