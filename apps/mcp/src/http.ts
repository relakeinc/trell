import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServerDeps } from "./server";
import { createMcpServer } from "./server";

function unauthorized(res: ServerResponse): void {
  // NOTE: 403 on purpose, not 401. Editors (VS Code) auto-start an OAuth
  // flow on any 401 from a remote MCP server; we use a static Bearer key
  // (no OAuth server), so 401 would trap users in a registration dialog.
  res.writeHead(403, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "forbidden", message: "invalid or missing MCP_API_KEY" }));
}

function notConfigured(res: ServerResponse): void {
  res.writeHead(503, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "mcp_not_configured", message: "set MCP_API_KEY" }));
}

/**
 * Stateless Streamable HTTP listener for the MCP server — safe behind a
 * reverse proxy (no session affinity). A fresh transport+server is created
 * per request: SDK transports are single-use once a request completes.
 * Fail-closed: without MCP_API_KEY every request is rejected.
 *
 * Only POST / is served. Unknown paths are 404 — notably the OAuth
 * discovery docs under /.well-known/*: this server uses a static Bearer
 * key and editors must not mistake it for an OAuth server.
 */
export function createMcpHttpListener(deps: McpServerDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
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

    const key = deps.config.apiKey;
    if (!key) {
      notConfigured(res);
      return;
    }
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(key, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      unauthorized(res);
      return;
    }

    let body: unknown;
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_json" }));
      return;
    }

    const server = createMcpServer(deps);
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
