import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ApiConfig } from "./config";
import type { Repo } from "./repositories/types";
import type { PrismaClient } from "@prisma/client";
import { RateLimiter } from "./middleware/ratelimit";
import { corsMiddleware, openCors } from "./middleware/cors";
import { ingestAuth } from "./middleware/auth";
import { skAuth } from "./middleware/skauth";
import { makeIngest } from "./routes/ingest";
import { makeProjects } from "./routes/projects";
import { makeAnalytics } from "./routes/analytics";
import { makeFunnels } from "./routes/funnels";
import { makeViews } from "./routes/views";
import { sendError } from "./lib/errors";

export interface AppDeps {
  repo: Repo;
  config: ApiConfig;
  limiter?: RateLimiter;
  /** Shared Prisma client. Absent in memory/dev mode (no webhook delivery). */
  prisma?: PrismaClient;
}

let cachedSdk: string | null = null;

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const ingest = makeIngest({ ...deps, prisma: deps.prisma });
  const projects = makeProjects(deps.repo, deps.config);
  const analytics = makeAnalytics(deps.repo);
  const funnels = makeFunnels(deps.repo);
  const views = makeViews(deps.repo);

  // CORS: ingestion open (pk), rest allowlisted; no "*" default, openness comes from openCors().
  const corsOrigins = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use("/v1/ingest", openCors());
  app.use("/v1/events", openCors());
  app.use("*", corsMiddleware(corsOrigins));

  app.onError((err, c) => {
    console.error("[trell:api] unhandled error", err);
    return sendError(c, 500, "internal_error", "internal server error");
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/sdk/trell.js", async (c) => {
    if (!cachedSdk) {
      try {
        cachedSdk = await readFile(join(import.meta.dirname, "../public/trell.min.js"), "utf-8");
      } catch {
        try {
          cachedSdk = await readFile(join(import.meta.dirname, "../public/trell.js"), "utf-8");
        } catch {
          return c.text("SDK not found", 404);
        }
      }
    }
    c.header("Content-Type", "application/javascript; charset=utf-8");
    c.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
    c.header("Access-Control-Allow-Origin", "*");
    return c.body(cachedSdk);
  });

  // Public ingestion (pk auth) + server-to-server (sk auth).
  app.options("/v1/ingest", (c) => ingest.preflight(c));
  app.options("/v1/events", (c) => ingest.preflight(c));
  app.post("/v1/ingest", ingestAuth(deps.repo), (c) => ingest.handler(c));
  app.post("/v1/events", ingestAuth(deps.repo), (c) => ingest.handler(c));

  // Management/analytics (sk auth) — private, never pk.
  app.post("/v1/projects", (c) => projects.handler(c));
  app.get("/v1/projects/:id/stats", skAuth(deps.repo), (c) => analytics.stats(c));
  app.get("/v1/projects/:id/series", skAuth(deps.repo), (c) => analytics.series(c));
  app.get("/v1/projects/:id/breakdown", skAuth(deps.repo), (c) => analytics.breakdown(c));
  app.get("/v1/projects/:id/forms", skAuth(deps.repo), (c) => analytics.forms(c));
  app.get("/v1/projects/:id/events", skAuth(deps.repo), (c) => analytics.events(c));
  app.get("/v1/projects/:id/funnel-live", skAuth(deps.repo), (c) => analytics.funnelLive(c));
  app.get("/v1/projects/:id/realtime", skAuth(deps.repo), (c) => analytics.realtime(c));

  app.get("/v1/projects/:id/funnels", skAuth(deps.repo), (c) => funnels.list(c));
  app.post("/v1/projects/:id/funnels", skAuth(deps.repo), (c) => funnels.create(c));
  app.get("/v1/projects/:id/funnels/:fid", skAuth(deps.repo), (c) => funnels.get(c));
  app.patch("/v1/projects/:id/funnels/:fid", skAuth(deps.repo), (c) => funnels.update(c));
  app.delete("/v1/projects/:id/funnels/:fid", skAuth(deps.repo), (c) => funnels.remove(c));
  app.post("/v1/projects/:id/funnel-compute", skAuth(deps.repo), (c) => funnels.compute(c));

  app.get("/v1/projects/:id/views", skAuth(deps.repo), (c) => views.list(c));
  app.post("/v1/projects/:id/views", skAuth(deps.repo), (c) => views.create(c));
  app.delete("/v1/projects/:id/views/:vid", skAuth(deps.repo), (c) => views.remove(c));

  return app;
}
