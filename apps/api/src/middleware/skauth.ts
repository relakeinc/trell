import type { MiddlewareHandler } from "hono";
import type { Repo } from "../repositories/types";
import { hashSk } from "../lib/crypto";
import { sendError } from "../lib/errors";

/**
 * Authenticates management/analytics requests with the SECRET key (sk_...).
 * The route path must contain `:id` (the project id) — sk is verified against
 * that project's stored hash. Never accepts the publishable key (pk).
 */
export function skAuth(repo: Repo): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const sk = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

    if (!sk) return sendError(c, 401, "missing_api_key", "missing secret key");

    const projectId = c.req.param("id");
    if (!projectId) return sendError(c, 404, "not_found", "project not found");
    const project = await repo.findProjectById(projectId);
    if (!project) return sendError(c, 404, "not_found", "project not found");

    if (hashSk(sk) !== project.apiKeyHash) {
      return sendError(c, 401, "invalid_api_key", "invalid secret key");
    }

    c.set("projectId", project.id);
    c.set("project", project);
    await next();
  };
}
