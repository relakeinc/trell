import { createMiddleware } from "hono/factory";

export function corsMiddleware(allowedOrigins: string[]) {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header("origin") ?? "";

    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      c.header("Access-Control-Allow-Origin", origin);
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
