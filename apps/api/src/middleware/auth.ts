import type { MiddlewareHandler } from "hono";
import type { Repo, ProjectRecord } from "../repositories/types";
import { isOriginAllowed } from "../lib/domain";
import { forbidden, unauthorized } from "../lib/errors";

declare module "hono" {
  interface ContextVariableMap {
    project: ProjectRecord;
    projectId: string;
    origin: string | null;
  }
}

function extractHost(originOrReferer: string | null): string | null {
  if (!originOrReferer) return null;
  try {
    return new URL(originOrReferer).host;
  } catch {
    return originOrReferer;
  }
}

/**
 * Authenticates via the publishable key (Bearer pk_...) and validates the
 * request origin against the project's allowed domains. Attaches `project`.
 */
export function pkAuth(repo: Repo): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const pk = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

    if (!pk) return unauthorized(c, "missing_api_key", "missing_api_key");

    const project = await repo.findProjectByPublishableKey(pk);
    if (!project) return unauthorized(c, "invalid_api_key", "invalid_api_key");

    const origin: string | null = c.req.header("origin") ?? c.req.header("referer") ?? null;
    const host = extractHost(origin);

    if (project.domains.trim() !== "") {
      if (!host || !isOriginAllowed(host, project.domains)) {
        return forbidden(c, "origin_not_allowed", "origin_not_allowed");
      }
      c.header("Access-Control-Allow-Origin", origin ?? "*");
    }

    c.set("project", project);
    c.set("projectId", project.id);
    c.set("origin", origin);
    await next();
  };
}
