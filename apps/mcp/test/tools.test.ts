import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/server";
import { mcpConfigFromEnv } from "../src/config";
import type {
  McpApiKey,
  McpEvent,
  McpEventFilter,
  McpFunnel,
  McpProject,
  McpStore,
  McpUtmTemplate,
  McpView,
  McpWebhook,
} from "../src/store";
import { getProject, listProjects } from "../src/tools/projects";
import { getStats } from "../src/tools/stats";
import { trackingCheckup } from "../src/tools/tracking";
import { getBreakdown, getForms, getSeries, queryEvents } from "../src/tools/analytics";
import { getFunnel, listApiKeys, listFunnels, listUtmTemplates, listViews, listWebhooks } from "../src/tools/entities";

const OPEN_CONFIG = mcpConfigFromEnv({ MCP_ALLOWED_SLUGS: "*" } as NodeJS.ProcessEnv);

function makeEvent(overrides: Partial<McpEvent> & { eventId: string; type: string; ts: Date }): McpEvent {
  return {
    sessionId: "sid",
    visitorId: "vid",
    url: "https://example.com/a",
    pagePath: "/a",
    pageTitle: "A",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    deviceType: "desktop",
    os: null,
    browser: null,
    formId: null,
    formName: null,
    ...overrides,
  };
}

class FakeStore implements McpStore {
  projects: McpProject[] = [];
  events = new Map<string, McpEvent[]>();
  funnels = new Map<string, McpFunnel[]>();
  views = new Map<string, McpView[]>();
  webhooks = new Map<string, McpWebhook[]>();
  utm = new Map<string, McpUtmTemplate[]>();
  keys = new Map<string, McpApiKey[]>();

  seedProject(p: McpProject): void {
    this.projects.push(p);
    this.events.set(p.id, []);
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

  async getEventsForAnalytics(projectId: string, filter: McpEventFilter): Promise<McpEvent[]> {
    return (this.events.get(projectId) ?? []).filter((e) => {
      if (filter.from && e.ts < filter.from) return false;
      if (filter.to && e.ts > filter.to) return false;
      if (filter.type && filter.type.length > 0 && !filter.type.includes(e.type)) return false;
      if (filter.form && e.formId !== filter.form) return false;
      return true;
    });
  }

  async listFunnels(projectId: string): Promise<McpFunnel[]> {
    return this.funnels.get(projectId) ?? [];
  }

  async listSavedViews(projectId: string): Promise<McpView[]> {
    return this.views.get(projectId) ?? [];
  }

  async listWebhooks(projectId: string): Promise<McpWebhook[]> {
    return this.webhooks.get(projectId) ?? [];
  }

  async listUtmTemplates(projectId: string): Promise<McpUtmTemplate[]> {
    return this.utm.get(projectId) ?? [];
  }

  async listApiKeys(projectId: string): Promise<McpApiKey[]> {
    return this.keys.get(projectId) ?? [];
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
  store.events.set(site.id, [
    makeEvent({ eventId: "e1", type: "form_submit", ts: new Date("2026-09-01T10:00:00Z"), formId: "contact", formName: "Contact", pagePath: "/contact" }),
    makeEvent({ eventId: "e2", type: "form_start", ts: new Date("2026-09-02T09:00:00Z"), formId: "contact", formName: "Contact", pagePath: "/contact" }),
    makeEvent({ eventId: "e3", type: "form_success", ts: new Date("2026-09-02T10:00:00Z"), formId: "contact", formName: "Contact", pagePath: "/contact" }),
    makeEvent({ eventId: "e4", type: "pageview", ts: new Date("2026-09-02T11:00:00Z"), pagePath: "/pricing" }),
  ]);
  store.funnels.set(site.id, [
    {
      id: "f1",
      name: "Signup",
      steps: [
        { eventType: "form_view", formId: "contact", label: "View", position: 0 },
        { eventType: "form_submit", formId: "contact", label: "Submit", position: 1 },
      ],
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-02T00:00:00Z"),
    },
  ]);
  store.views.set(site.id, [{ id: "v1", name: "Main", type: "events", createdAt: new Date("2026-04-01T00:00:00Z") }]);
  store.webhooks.set(site.id, [
    { id: "w1", url: "https://hooks.example.com/t", events: ["form_submit"], enabled: true, createdAt: new Date("2026-05-01T00:00:00Z") },
  ]);
  store.utm.set(site.id, [
    {
      id: "u1", name: "Summer", source: "google", medium: "cpc", campaign: "summer",
      term: null, content: null, referral: null, createdAt: new Date("2026-06-01T00:00:00Z"),
    },
  ]);
  store.keys.set(site.id, [
    { id: "k1", name: "prod", keyPrefix: "sk_abc", createdAt: new Date("2026-07-01T00:00:00Z") },
  ]);
  return { store, siteId: site.id };
}

function readJson(result: { content: { type: string; text?: string }[]; isError?: boolean }): unknown {
  const first = result.content[0];
  if (!first || first.type !== "text" || !first.text) throw new Error("expected text content");
  return JSON.parse(first.text);
}

const RANGE = { from: "2026-09-01T00:00:00Z", to: "2026-09-03T00:00:00Z" };

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
    const body = readJson(await getStats(store, OPEN_CONFIG, { project: "site", ...RANGE })) as {
      total: number;
      byType: Record<string, number>;
      topForms: { key: string; count: number }[];
    };
    expect(body.total).toBe(4);
    expect(body.byType).toEqual({ form_submit: 1, form_start: 1, form_success: 1, pageview: 1 });
    expect(body.topForms).toEqual([{ key: "contact", count: 3 }]);
  });

  it("applies the date filter", async () => {
    const { store } = seedStore();
    const body = readJson(
      await getStats(store, OPEN_CONFIG, { project: "site", from: "2026-09-02T00:00:00Z", to: "2026-09-03T00:00:00Z" }),
    ) as { total: number };
    expect(body.total).toBe(3);
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

describe("analytics tools", () => {
  it("get_series buckets by day with gap filling", async () => {
    const { store } = seedStore();
    const body = readJson(await getSeries(store, OPEN_CONFIG, { project: "site", interval: "day", ...RANGE })) as {
      series: { bucket: string; count: number }[];
    };
    expect(body.series).toEqual([
      { bucket: "2026-09-01T00:00:00.000Z", count: 1 },
      { bucket: "2026-09-02T00:00:00.000Z", count: 3 },
      { bucket: "2026-09-03T00:00:00.000Z", count: 0 },
    ]);
  });

  it("get_series rejects bad intervals", async () => {
    const { store } = seedStore();
    const res = await getSeries(store, OPEN_CONFIG, {
      project: "site",
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      interval: "year" as "day",
      ...RANGE,
    });
    expect(res.isError).toBe(true);
  });

  it("get_breakdown groups by dimension with limit", async () => {
    const { store } = seedStore();
    const body = readJson(
      await getBreakdown(store, OPEN_CONFIG, { project: "site", dimension: "type", ...RANGE }),
    ) as { rows: { value: string; count: number }[] };
    expect(body.rows).toHaveLength(4);
    expect(body.rows[0]).toEqual({ value: "form_submit", count: 1 });
    const limited = readJson(
      await getBreakdown(store, OPEN_CONFIG, { project: "site", dimension: "type", limit: 2, ...RANGE }),
    ) as { rows: unknown[] };
    expect(limited.rows).toHaveLength(2);
  });

  it("get_forms computes conversion rate as successes/starts", async () => {
    const { store } = seedStore();
    const body = readJson(
      await getForms(store, OPEN_CONFIG, { project: "site", ...RANGE }),
    ) as { forms: { id: string; starts: number; successes: number; conversionRate: number }[] };
    expect(body.forms).toEqual([
      { id: "contact", name: "Contact", events: 3, starts: 1, successes: 1, conversionRate: 1 },
    ]);
  });

  it("query_events paginates newest-first with cursor", async () => {
    const { store } = seedStore();
    const first = readJson(
      await queryEvents(store, OPEN_CONFIG, { project: "site", limit: 2, ...RANGE }),
    ) as { events: { eventId: string }[]; total: number; nextCursor: string };
    expect(first.total).toBe(4);
    expect(first.events.map((e) => e.eventId)).toEqual(["e2", "e1"]);
    expect(first.nextCursor).toBe("e2");
    const second = readJson(
      await queryEvents(store, OPEN_CONFIG, { project: "site", limit: 2, cursor: first.nextCursor, ...RANGE }),
    ) as { events: { eventId: string }[]; nextCursor: string | null };
    expect(second.events.map((e) => e.eventId)).toEqual(["e4", "e3"]);
    expect(second.nextCursor).toBeNull();
  });
});

describe("entity tools", () => {
  it("list_funnels / get_funnel by id and name", async () => {
    const { store } = seedStore();
    const list = readJson(await listFunnels(store, OPEN_CONFIG, { project: "site" })) as {
      funnels: { id: string; name: string }[];
    };
    expect(list.funnels.map((f) => f.name)).toEqual(["Signup"]);
    const byId = readJson(await getFunnel(store, OPEN_CONFIG, { project: "site", funnel: "f1" })) as {
      funnel: { name: string };
    };
    expect(byId.funnel.name).toBe("Signup");
    const byName = readJson(await getFunnel(store, OPEN_CONFIG, { project: "site", funnel: "signup" })) as {
      funnel: { id: string };
    };
    expect(byName.funnel.id).toBe("f1");
    const missing = await getFunnel(store, OPEN_CONFIG, { project: "site", funnel: "nope" });
    expect(missing.isError).toBe(true);
  });

  it("list_views / list_webhooks / list_utm_templates / list_api_keys", async () => {
    const { store } = seedStore();
    const views = readJson(await listViews(store, OPEN_CONFIG, { project: "site" })) as {
      views: { name: string }[];
    };
    expect(views.views.map((v) => v.name)).toEqual(["Main"]);
    const webhooks = readJson(await listWebhooks(store, OPEN_CONFIG, { project: "site" })) as {
      webhooks: { url: string; secret?: string }[];
    };
    expect(webhooks.webhooks).toHaveLength(1);
    expect(webhooks.webhooks[0]?.url).toBe("https://hooks.example.com/t");
    expect(webhooks.webhooks[0]).not.toHaveProperty("secret");
    const utm = readJson(await listUtmTemplates(store, OPEN_CONFIG, { project: "site" })) as {
      templates: { name: string; source: string }[];
    };
    expect(utm.templates).toEqual([
      expect.objectContaining({ name: "Summer", source: "google" }),
    ]);
    const keys = readJson(await listApiKeys(store, OPEN_CONFIG, { project: "site" })) as {
      keys: { name: string; keyPrefix: string; keyHash?: string; secret?: string }[];
    };
    expect(keys.keys).toEqual([expect.objectContaining({ name: "prod", keyPrefix: "sk_abc" })]);
    expect(keys.keys[0]).not.toHaveProperty("keyHash");
    expect(keys.keys[0]).not.toHaveProperty("secret");
  });

  it("entity lists are scoped per project", async () => {
    const { store } = seedStore();
    const other = readJson(await listWebhooks(store, OPEN_CONFIG, { project: "other" })) as {
      webhooks: unknown[];
    };
    expect(other.webhooks).toEqual([]);
  });
});

describe("MCP protocol smoke test", () => {
  it("exposes tools, resources and prompts", async () => {
    const { store } = seedStore();
    const server = createMcpServer({ store, config: OPEN_CONFIG });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_breakdown",
      "get_forms",
      "get_funnel",
      "get_project",
      "get_series",
      "get_stats",
      "list_api_keys",
      "list_funnels",
      "list_projects",
      "list_utm_templates",
      "list_views",
      "list_webhooks",
      "query_events",
      "tracking_checkup",
    ]);

    const res = await client.callTool({ name: "tracking_checkup", arguments: { project: "site" } });
    const content = res.content as { type: string; text?: string }[];
    const body = JSON.parse(content[0]?.text ?? "{}") as { connected: boolean };
    expect(body.connected).toBe(true);

    const { resources } = await client.listResources();
    expect(resources.map((r) => r.name).sort()).toEqual(["event-schema", "projects"]);

    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.name)).toEqual(["usage"]);

    const usage = await client.readResource({ uri: "trell://projects/site/usage" });
    const usageText = (usage.contents[0] as { text?: string })?.text ?? "{}";
    expect(JSON.parse(usageText) as { eventsLast30d: number }).toMatchObject({ project: "site" });

    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["tracking_setup_help", "weekly_report"]);

    const prompt = await client.getPrompt({ name: "weekly_report", arguments: { project: "site" } });
    expect(prompt.messages).toHaveLength(1);

    await client.close();
    await server.close();
  });
});
