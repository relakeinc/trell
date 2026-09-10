import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createMcpHttpListener } from "../src/http";
import { mcpConfigFromEnv } from "../src/config";
import { signJwt } from "../src/oauth";
import type { McpProject, McpStore } from "../src/store";

class FakeStore implements McpStore {
  async listProjects(): Promise<McpProject[]> {
    return [
      {
        id: "p1",
        slug: "site",
        name: "Site",
        plan: "free",
        publishableKey: "pk_x",
        domains: "",
        createdAt: new Date(),
      },
    ];
  }
  async findProjectById(): Promise<McpProject | null> {
    return null;
  }
  async findProjectBySlug(): Promise<McpProject | null> {
    return null;
  }
  async getEventsForAnalytics(): Promise<[]> {
    return [];
  }

  async listFunnels(): Promise<[]> {
    return [];
  }

  async listSavedViews(): Promise<[]> {
    return [];
  }

  async listWebhooks(): Promise<[]> {
    return [];
  }

  async listUtmTemplates(): Promise<[]> {
    return [];
  }

  async listApiKeys(): Promise<[]> {
    return [];
  }

  async findUserByEmail(): Promise<null> {
    return null;
  }

  async listMemberships(): Promise<[]> {
    return [];
  }
}

const KEY = "test-bearer-key-0123456789abcdef";

async function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const config = mcpConfigFromEnv({ MCP_API_KEY: KEY } as NodeJS.ProcessEnv);
  const listener = createMcpHttpListener({ store: new FakeStore(), config });
  const srv = createServer((req, res) => void listener(req, res));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve()))),
  };
}

async function post(url: string, id: number, method: string, params: unknown, key = KEY, path = "/") {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return { status: res.status, body: await res.text() };
}

describe("MCP HTTP listener", () => {
  it("handles initialize + tool call as sequential requests", async () => {
    const { url, close } = await startServer();
    try {
      const init = await post(url, 1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "t", version: "0" },
      });
      expect(init.status).toBe(200);
      const call = await post(url, 2, "tools/call", { name: "list_projects", arguments: {} });
      expect(call.status).toBe(200);
      expect(call.body).toContain('\\"slug\\":\\"site\\"');
    } finally {
      await close();
    }
  });

  it("503s /authorize without Google configured, 404 elsewhere", async () => {
    const { url, close } = await startServer();
    try {
      const page = await fetch(`${url}/authorize?client_id=x`);
      expect(page.status).toBe(503);
      await page.arrayBuffer();
      const other = await fetch(`${url}/nope`);
      expect(other.status).toBe(404);
      await other.arrayBuffer();
    } finally {
      await close();
    }
  });
  it("accepts an OAuth access token as Bearer (identity has no account here)", async () => {
    const { url, close } = await startServer();
    try {
      // oauthSecret falls back to MCP_API_KEY in test config.
      const token = signJwt({ type: "access", email: "nobody@x.test" }, KEY, 3600);
      const res = await post(url, 4, "tools/call", { name: "list_projects", arguments: {} }, token);
      expect(res.status).toBe(200);
      expect(res.body).toContain("project_forbidden");
    } finally {
      await close();
    }
  });

  it("rejects missing bearer with 403 (never 401: editors auto-start OAuth on 401) and GET with 405", async () => {
    const { url, close } = await startServer();
    try {
      const noAuth = await post(url, 3, "tools/call", { name: "list_projects", arguments: {} }, "");
      expect(noAuth.status).toBe(403);
      const get = await fetch(url);
      expect(get.status).toBe(405);
      await get.arrayBuffer();
    } finally {
      await close();
    }
  });

  it("serves OAuth discovery metadata", async () => {
    const { url, close } = await startServer();
    try {
      const meta = await (await fetch(`${url}/.well-known/oauth-protected-resource`)).json();
      expect((meta as { authorization_servers: string[] }).authorization_servers).toEqual([
        "https://mcp.relake.co",
      ]);
      const as = await (await fetch(`${url}/.well-known/oauth-authorization-server`)).json();
      expect((as as { registration_endpoint: string }).registration_endpoint).toContain("/register");
    } finally {
      await close();
    }
  });

  it("fails closed without MCP_API_KEY", async () => {
    const config = mcpConfigFromEnv({} as NodeJS.ProcessEnv);
    const listener = createMcpHttpListener({ store: new FakeStore(), config });
    const srv = createServer((req, res) => void listener(req, res));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    try {
      const { port } = srv.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
      expect(res.status).toBe(503);
      await res.arrayBuffer();
    } finally {
      await new Promise<void>((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
    }
  });
});
