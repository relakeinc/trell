import { createMiddleware } from "hono/factory";

/**
 * Strict CORS for management/analytics routes: only reflects origins that are
 * explicitly allowlisted. Never use "*" here — these routes accept secret keys.
 */
export function corsMiddleware(allowedOrigins: string[]) {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header("origin") ?? "";

    if (origin && allowedOrigins.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }

    c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");
    c.header("Access-Control-Max-Age", "86400");

    if (c.req.method === "OPTIONS") {
      return c.text("", 204 as any);
    }

    await next();
  });
}

/**
 * Open CORS for public ingestion routes (/v1/ingest, /v1/events) and the
 * public SDK asset. The browser SDK posts cross-origin with publishable
 * keys, so any site must be able to reach these. No cookies are involved.
 */
export function openCors() {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header("origin") ?? "";

    c.header("Access-Control-Allow-Origin", origin || "*");
    if (origin) c.header("Vary", "Origin");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", "86400");

    if (c.req.method === "OPTIONS") {
      return c.text("", 204 as any);
    }

    await next();
  });
}
