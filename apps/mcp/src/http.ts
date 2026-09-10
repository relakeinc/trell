import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServerDeps } from "./server";
import { createMcpServer } from "./server";
import { beginAuthorize, handleCallback, handleRegister, handleToken, verifyAccessToken } from "./oauth";

function unauthorized(res: ServerResponse): void {
  // NOTE: 403 on purpose, not 401. Editors (VS Code) auto-start an OAuth
  // flow on any 401 from a remote MCP server; with a static Bearer key and
  // no completed login, a 401 traps users in a registration dialog.
  res.writeHead(403, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "forbidden", message: "invalid or missing credentials" }));
}

function notConfigured(res: ServerResponse): void {
  res.writeHead(503, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "mcp_not_configured", message: "set MCP_API_KEY" }));
}

function htmlError(res: ServerResponse, status: number, title: string, message: string): void {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem">` +
      `<h1>${esc(title)}</h1><p>${esc(message)}</p></body></html>`,
  );
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Stateless Streamable HTTP listener for the MCP server — safe behind a
 * reverse proxy (no session affinity). A fresh transport+server is created
 * per request: SDK transports are single-use once a request completes.
 *
 * Auth, in order:
 *  1. OAuth discovery + DCR + authorize/callback/token (login with Google).
 *  2. POST / with Bearer = legacy MCP_API_KEY (service/bot mode) or a
 *     verified OAuth access token (per-user mode, identity from the token).
 * Unknown paths are 404 so editors never mistake this for something else.
 */
export function createMcpHttpListener(deps: McpServerDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const issuer = deps.config.publicUrl;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    // ── OAuth discovery (RFC 9728) ───────────────────────────
    if (req.method === "GET" && pathname === "/.well-known/oauth-protected-resource") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ resource: issuer, authorization_servers: [issuer] }));
      return;
    }
    if (req.method === "GET" && pathname === "/.well-known/oauth-authorization-server") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          registration_endpoint: `${issuer}/register`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_method: "none",
        }),
      );
      return;
    }

    // ── Dynamic client registration (RFC 7591) ───────────────
    if (pathname === "/register") {
      if (req.method !== "POST") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "method_not_allowed" }));
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_request" }));
        return;
      }
      const out = handleRegister((body ?? {}) as { redirect_uris?: unknown });
      res.writeHead(out.status, { "content-type": "application/json" });
      res.end(JSON.stringify(out.json));
      return;
    }

    // ── Login entry: bounce to Google ────────────────────────
    if (pathname === "/authorize") {
      if (req.method !== "GET") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "method_not_allowed" }));
        return;
      }
      const out = beginAuthorize(deps.config, {
        client_id: url.searchParams.get("client_id") ?? undefined,
        redirect_uri: url.searchParams.get("redirect_uri") ?? undefined,
        code_challenge: url.searchParams.get("code_challenge") ?? undefined,
        code_challenge_method: url.searchParams.get("code_challenge_method") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        response_type: url.searchParams.get("response_type") ?? undefined,
      });
      if (out.redirect) {
        res.writeHead(302, { location: out.redirect });
        res.end();
        return;
      }
      htmlError(res, out.status ?? 400, "Trell MCP login", out.text ?? "invalid request");
      return;
    }

    // ── Google redirects back here ───────────────────────────
    if (pathname === "/oauth/callback") {
      if (req.method !== "GET") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "method_not_allowed" }));
        return;
      }
      const out = await handleCallback(deps.config, {
        code: url.searchParams.get("code") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        error: url.searchParams.get("error") ?? undefined,
      });
      if (out.redirect) {
        res.writeHead(302, { location: out.redirect });
        res.end();
        return;
      }
      htmlError(res, out.status ?? 400, "Trell MCP login", out.text ?? "login was not completed");
      return;
    }

    // ── Token exchange (PKCE) + refresh ──────────────────────
    if (pathname === "/token") {
      if (req.method !== "POST") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "method_not_allowed" }));
        return;
      }
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const body: Record<string, string> = {};
      for (const [k, v] of params) body[k] = v;
      const out = handleToken(deps.config, body);
      res.writeHead(out.status, { "content-type": "application/json" });
      res.end(JSON.stringify(out.json));
      return;
    }

    // ── MCP endpoint ─────────────────────────────────────────
    if (pathname !== "/") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    // Bearer = legacy service key (no identity) or OAuth access token (identity).
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    let identity: { email: string } | null = null;
    if (deps.config.apiKey && token) {
      const a = Buffer.from(token, "utf8");
      const b = Buffer.from(deps.config.apiKey, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) {
        identity = null;
      } else {
        const email = verifyAccessToken(deps.config, token);
        if (!email) {
          unauthorized(res);
          return;
        }
        identity = { email };
      }
    } else if (token) {
      const email = verifyAccessToken(deps.config, token);
      if (!email) {
        unauthorized(res);
        return;
      }
      identity = { email };
    } else {
      if (!deps.config.apiKey) {
        notConfigured(res);
        return;
      }
      unauthorized(res);
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_json" }));
      return;
    }

    const server = createMcpServer({ store: deps.store, config: { ...deps.config, identity } });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "internal_error" }));
      }
    } finally {
      await server.close().catch(() => {});
    }
  };
}
