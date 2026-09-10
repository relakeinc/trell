import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/server";
import { mcpConfigFromEnv } from "../src/config";
import type { McpEvent, McpProject, McpStore } from "../src/store";
import { getProject, listProjects } from "../src/tools/projects";
import { getStats } from "../src/tools/stats";
import { trackingCheckup } from "../src/tools/tracking";

const OPEN_CONFIG = mcpConfigFromEnv({ MCP_ALLOWED_SLUGS: "*" } as NodeJS.ProcessEnv);

class FakeStore implements McpStore {
  projects: McpProject[] = [];
  events = new Map<string, McpEvent[]>();

  seedProject(p: McpProject): void {
    this.projects.push(p);
    this.events.set(p.id, []);
  }

  seedEvents(projectId: string, events: McpEvent[]): void {
    this.events.set(projectId, events);
  }

  async listProjects(): Promise<McpProject[]> {
    return [...this.projects].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findProjectById(id: string): Promise<McpProject | null> {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  async findProjectBySlug(slug: string): Promise<McpProject | null> {
    return this.projects.find((p) => p.slug === slug) ?? null;
  }

  async getEventsForAnalytics(
    projectId: string,
    filter: { from?: Date; to?: Date; type?: string[] },
  ): Promise<McpEvent[]> {
    return (this.events.get(projectId) ?? []).filter((e) => {
      if (filter.from && e.ts < filter.from) return false;
      if (filter.to && e.ts > filter.to) return false;
      if (filter.type && filter.type.length > 0 && !filter.type.includes(e.type)) return false;
      return true;
    });
  }
}

function seedStore(): { store: FakeStore; siteId: string } {
  const store = new FakeStore();
  const site: McpProject = {
    id: "proj_site",
    slug: "site",
    name: "Site",
    plan: "free",
    publishableKey: "pk_site_123",
    domains: "example.com",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  store.seedProject(site);
  store.seedProject({
    id: "proj_other",
    slug: "other",
    name: "Other",
    plan: "free",
    publishableKey: "pk_other_123",
    domains: "",
    createdAt: new Date("2026-02-01T00:00:00Z"),
  });
  store.seedEvents(site.id, [
    { type: "form_submit", ts: new Date("2026-09-01T10:00:00Z"), formId: "contact", pagePath: "/contact" },
    { type: "form_submit", ts: new Date("2026-09-02T10:00:00Z"), formId: "contact", pagePath: "/contact" },
    { type: "pageview", ts: new Date("2026-09-02T11:00:00Z"), formId: null, pagePath: "/pricing" },
  ]);
  return { store, siteId: site.id };
}

function readJson(result: { content: { type: string; text?: string }[]; isError?: boolean }): unknown {
  const first = result.content[0];
  if (!first || first.type !== "text" || !first.text) throw new Error("expected text content");
  return JSON.parse(first.text);
}

describe("list_projects / get_project", () => {
  it("lists all workspaces", async () => {
    const { store } = seedStore();
    const res = await listProjects(store, OPEN_CONFIG);
    expect(res.isError).toBeUndefined();
    const body = readJson(res) as { projects: { slug: string }[] };
    expect(body.projects.map((p) => p.slug).sort()).toEqual(["other", "site"]);
  });

  it("honors MCP_ALLOWED_SLUGS", async () => {
    const { store } = seedStore();
    const config = mcpConfigFromEnv({ MCP_ALLOWED_SLUGS: "site" } as NodeJS.ProcessEnv);
    const res = await listProjects(store, config);
    const body = readJson(res) as { projects: { slug: string }[] };
    expect(body.projects.map((p) => p.slug)).toEqual(["site"]);
  });

  it("resolves by slug and by id", async () => {
    const { store, siteId } = seedStore();
    const bySlug = readJson(await getProject(store, OPEN_CONFIG, { project: "site" })) as { slug: string };
    const byId = readJson(await getProject(store, OPEN_CONFIG, { project: siteId })) as { slug: string };
    expect(bySlug.slug).toBe("site");
    expect(byId.slug).toBe("site");
  });

  it("returns project_not_found for unknown workspaces", async () => {
    const { store } = seedStore();
    const res = await getProject(store, OPEN_CONFIG, { project: "nope" });
    expect(res.isError).toBe(true);
    expect((readJson(res) as { error: { code: string } }).error.code).toBe("project_not_found");
  });

  it("returns project_forbidden outside the allowlist", async () => {
    const { store } = seedStore();
    const config = mcpConfigFromEnv({ MCP_ALLOWED_SLUGS: "site" } as NodeJS.ProcessEnv);
    const res = await getProject(store, config, { project: "other" });
    expect(res.isError).toBe(true);
    expect((readJson(res) as { error: { code: string } }).error.code).toBe("project_forbidden");
  });
});

describe("get_stats", () => {
  it("counts totals, by type, top forms and pages", async () => {
    const { store } = seedStore();
    const body = readJson(
      await getStats(store, OPEN_CONFIG, { project: "site", from: "2026-09-01T00:00:00Z", to: "2026-09-03T00:00:00Z" }),
    ) as { total: number; byType: Record<string, number>; topForms: { key: string; count: number }[] };
    expect(body.total).toBe(3);
    expect(body.byType).toEqual({ form_submit: 2, pageview: 1 });
    expect(body.topForms).toEqual([{ key: "contact", count: 2 }]);
  });

  it("applies the date filter", async () => {
    const { store } = seedStore();
    const body = readJson(
      await getStats(store, OPEN_CONFIG, { project: "site", from: "2026-09-02T00:00:00Z", to: "2026-09-03T00:00:00Z" }),
    ) as { total: number };
    expect(body.total).toBe(2);
  });

  it("rejects inverted and oversized ranges", async () => {
    const { store } = seedStore();
    const inverted = await getStats(store, OPEN_CONFIG, {
      project: "site",
      from: "2026-09-03T00:00:00Z",
      to: "2026-09-01T00:00:00Z",
    });
    expect(inverted.isError).toBe(true);
    const huge = await getStats(store, OPEN_CONFIG, {
      project: "site",
      from: "2020-01-01T00:00:00Z",
      to: "2026-09-03T00:00:00Z",
    });
    expect(huge.isError).toBe(true);
    expect((readJson(huge) as { error: { code: string } }).error.code).toBe("invalid_input");
  });
});

describe("tracking_checkup", () => {
  it("reports connected with last event", async () => {
    const { store } = seedStore();
    const body = readJson(await trackingCheckup(store, OPEN_CONFIG, { project: "site" })) as {
      connected: boolean;
      lastEventAt: string;
      findings: string[];
    };
    expect(body.connected).toBe(true);
    expect(body.lastEventAt).toBe("2026-09-02T11:00:00.000Z");
    expect(body.findings).toEqual([]);
  });

  it("warns on empty allowlist and no events", async () => {
    const { store } = seedStore();
    const body = readJson(await trackingCheckup(store, OPEN_CONFIG, { project: "other" })) as {
      connected: boolean;
      findings: string[];
    };
    expect(body.connected).toBe(false);
    expect(body.findings.length).toBe(2);
  });
});

describe("MCP protocol smoke test", () => {
  it("exposes 4 tools over in-memory transport", async () => {
    const { store } = seedStore();
    const server = createMcpServer({ store, config: OPEN_CONFIG });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_project",
      "get_stats",
      "list_projects",
      "tracking_checkup",
    ]);

    const res = await client.callTool({
      name: "tracking_checkup",
      arguments: { project: "site" },
    });
    const content = res.content as { type: string; text?: string }[];
    const body = JSON.parse(content[0]?.text ?? "{}") as { connected: boolean };
    expect(body.connected).toBe(true);

    await client.close();
    await server.close();
  });
});
