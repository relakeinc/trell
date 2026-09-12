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
import {
  addDomain,
  createApiKey,
  createFunnel,
  createUtmTemplate,
  createWebhook,
  deleteFunnel,
  deleteUtmTemplate,
  deleteWebhook,
  removeDomain,
  updateFunnel,
  updateUtmTemplate,
} from "../src/tools/writes";
import { deleteProject, revokeApiKey, rotateProjectSecret } from "../src/tools/destructive";
import { FakeStore, makeEvent } from "./fake";

const OPEN_CONFIG = mcpConfigFromEnv({ MCP_ALLOWED_SLUGS: "*" } as NodeJS.ProcessEnv);

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
    makeEvent({
      eventId: "e1",
      type: "form_submit",
      ts: new Date("2026-09-01T10:00:00Z"),
      formId: "contact",
      formName: "Contact",
      pagePath: "/contact",
    }),
    makeEvent({
      eventId: "e2",
      type: "form_start",
      ts: new Date("2026-09-02T09:00:00Z"),
      formId: "contact",
      formName: "Contact",
      pagePath: "/contact",
    }),
    makeEvent({
      eventId: "e3",
      type: "form_success",
      ts: new Date("2026-09-02T10:00:00Z"),
      formId: "contact",
      formName: "Contact",
      pagePath: "/contact",
    }),
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
    {
      id: "w1",
      url: "https://hooks.example.com/t",
      events: ["form_submit"],
      enabled: true,
      createdAt: new Date("2026-05-01T00:00:00Z"),
    },
  ]);
  store.utm.set(site.id, [
    {
      id: "u1",
      name: "Summer",
      source: "google",
      medium: "cpc",
      campaign: "summer",
      term: null,
      content: null,
      referral: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
    },
  ]);
  store.keys.set(site.id, [
    { id: "k1", name: "prod", keyPrefix: "sk_abc", createdAt: new Date("2026-07-01T00:00:00Z") },
  ]);
  store.users.set("me@x.test", { id: "u1", email: "me@x.test" });
  store.memberships.push({ userId: "u1", projectId: site.id, role: "owner" });
  store.users.set("member@x.test", { id: "u2", email: "member@x.test" });
  store.memberships.push({ userId: "u2", projectId: site.id, role: "member" });
  return { store, siteId: site.id };
}

function identityConfig(email: string) {
  return { ...OPEN_CONFIG, identity: { email } };
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

describe("per-user identity", () => {
  it("list_projects returns only member workspaces", async () => {
    const { store } = seedStore();
    const res = await listProjects(store, identityConfig("me@x.test"));
    const body = readJson(res) as { projects: { slug: string }[] };
    expect(body.projects.map((p) => p.slug)).toEqual(["site"]);
  });

  it("denies workspaces outside the caller's account", async () => {
    const { store } = seedStore();
    const res = await getProject(store, identityConfig("me@x.test"), { project: "other" });
    expect(res.isError).toBe(true);
    expect((readJson(res) as { error: { code: string } }).error.code).toBe("project_forbidden");
  });

  it("denies logins without a Trell account", async () => {
    const { store } = seedStore();
    const res = await getProject(store, identityConfig("ghost@x.test"), { project: "site" });
    expect(res.isError).toBe(true);
    expect((readJson(res) as { error: { code: string } }).error.code).toBe("project_forbidden");
  });

  it("honors MCP_ALLOWED_EMAILS", async () => {
    const { store } = seedStore();
    const config = {
      ...mcpConfigFromEnv({ MCP_ALLOWED_EMAILS: "boss@x.test" } as NodeJS.ProcessEnv),
      identity: { email: "me@x.test" },
    };
    const res = await listProjects(store, config);
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
    const body = readJson(await getBreakdown(store, OPEN_CONFIG, { project: "site", dimension: "type", ...RANGE })) as {
      rows: { value: string; count: number }[];
    };
    expect(body.rows).toHaveLength(4);
    expect(body.rows[0]).toEqual({ value: "form_submit", count: 1 });
    const limited = readJson(
      await getBreakdown(store, OPEN_CONFIG, { project: "site", dimension: "type", limit: 2, ...RANGE }),
    ) as { rows: unknown[] };
    expect(limited.rows).toHaveLength(2);
  });

  it("get_forms computes conversion rate as successes/starts", async () => {
    const { store } = seedStore();
    const body = readJson(await getForms(store, OPEN_CONFIG, { project: "site", ...RANGE })) as {
      forms: { id: string; starts: number; successes: number; conversionRate: number }[];
    };
    expect(body.forms).toEqual([
      { id: "contact", name: "Contact", events: 3, starts: 1, successes: 1, conversionRate: 1 },
    ]);
  });

  it("query_events paginates newest-first with cursor", async () => {
    const { store } = seedStore();
    const first = readJson(await queryEvents(store, OPEN_CONFIG, { project: "site", limit: 2, ...RANGE })) as {
      events: { eventId: string }[];
      total: number;
      nextCursor: string;
    };
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

describe("write tools", () => {
  it("creates, updates and deletes a funnel", async () => {
    const { store } = seedStore();
    const created = readJson(
      await createFunnel(store, OPEN_CONFIG, {
        project: "site",
        name: " Checkout ",
        steps: [
          { eventType: "form_view", formId: "c" },
          { eventType: "form_submit", formId: "c", label: "Pay" },
        ],
      }),
    ) as { funnel: { id: string; name: string } };
    expect(created.funnel.name).toBe("Checkout");
    const renamed = readJson(
      await updateFunnel(store, OPEN_CONFIG, { project: "site", funnel: created.funnel.id, name: "Pay" }),
    ) as { funnel: { name: string } };
    expect(renamed.funnel.name).toBe("Pay");
    await deleteFunnel(store, OPEN_CONFIG, { project: "site", funnel: created.funnel.id });
    const list = readJson(await listFunnels(store, OPEN_CONFIG, { project: "site" })) as {
      funnels: { id: string }[];
    };
    expect(list.funnels.map((f) => f.id)).not.toContain(created.funnel.id);
  });

  it("rejects funnel writes outside the caller's account", async () => {
    const { store } = seedStore();
    const res = await createFunnel(store, identityConfig("me@x.test"), {
      project: "other",
      name: "X",
      steps: [{ eventType: "pageview" }],
    });
    expect(res.isError).toBe(true);
  });

  it("creates, updates and deletes a UTM template", async () => {
    const { store } = seedStore();
    const created = readJson(
      await createUtmTemplate(store, OPEN_CONFIG, { project: "site", name: " Fall ", source: "google " }),
    ) as { template: { id: string; name: string } };
    expect(created.template.name).toBe("Fall");
    const updated = readJson(
      await updateUtmTemplate(store, OPEN_CONFIG, { project: "site", template: created.template.id, medium: "cpc" }),
    ) as { template: { id: string } };
    expect(updated.template.id).toBe(created.template.id);
    await deleteUtmTemplate(store, OPEN_CONFIG, { project: "site", template: created.template.id });
    const missing = await updateUtmTemplate(store, OPEN_CONFIG, { project: "site", template: created.template.id });
    expect(missing.isError).toBe(true);
  });

  it("adds and removes domains normalized", async () => {
    const { store } = seedStore();
    const added = readJson(
      await addDomain(store, OPEN_CONFIG, { project: "other", domain: "HTTPS://Shop.Example.com/path/" }),
    ) as { domains: string[] };
    expect(added.domains).toEqual(["shop.example.com"]);
    const idempotent = readJson(
      await addDomain(store, OPEN_CONFIG, { project: "other", domain: "shop.example.com" }),
    ) as {
      domains: string[];
    };
    expect(idempotent.domains).toEqual(["shop.example.com"]);
    const bad = await addDomain(store, OPEN_CONFIG, { project: "other", domain: "not a domain!!" });
    expect(bad.isError).toBe(true);
    const removed = readJson(
      await removeDomain(store, OPEN_CONFIG, { project: "other", domain: "SHOP.example.com" }),
    ) as {
      domains: string[];
    };
    expect(removed.domains).toEqual([]);
  });

  it("creates and deletes webhooks with URL validation", async () => {
    const { store } = seedStore();
    const bad = await createWebhook(store, OPEN_CONFIG, { project: "site", url: "ftp://x", events: ["form_submit"] });
    expect(bad.isError).toBe(true);
    const empty = await createWebhook(store, OPEN_CONFIG, {
      project: "site",
      url: "https://h.example.com/w",
      events: [],
    });
    expect(empty.isError).toBe(true);
    const created = readJson(
      await createWebhook(store, OPEN_CONFIG, {
        project: "site",
        url: "https://h.example.com/w",
        events: ["form_submit", "form_submit"],
      }),
    ) as { webhook: { id: string; events: string[] } };
    expect(created.webhook.events).toEqual(["form_submit"]);
    await deleteWebhook(store, OPEN_CONFIG, { project: "site", webhook: created.webhook.id });
    const gone = await deleteWebhook(store, OPEN_CONFIG, { project: "site", webhook: created.webhook.id });
    expect(gone.isError).toBe(true);
  });

  it("creates server keys showing the secret once", async () => {
    const { store } = seedStore();
    const created = readJson(await createApiKey(store, OPEN_CONFIG, { project: "site", name: "ci" })) as {
      key: { id: string };
      secret: string;
      warning: string;
    };
    expect(created.secret).toMatch(/^sk_[0-9a-f]{64}$/);
    expect(created.warning).toContain(".env");
    const list = readJson(await listApiKeys(store, OPEN_CONFIG, { project: "site" })) as {
      keys: { id: string; secret?: string }[];
    };
    expect(list.keys.map((k) => k.id)).toContain(created.key.id);
    expect(list.keys.every((k) => !("secret" in k))).toBe(true);
  });
});

describe("destructive tools", () => {
  const FLAGGED = mcpConfigFromEnv({ MCP_ALLOWED_SLUGS: "*", MCP_ALLOW_DESTRUCTIVE: "true" } as NodeJS.ProcessEnv);

  it("revoke_api_key needs flag + confirm + owner", async () => {
    const { store } = seedStore();
    const noFlag = await revokeApiKey(store, OPEN_CONFIG, { project: "site", key: "k1", confirm: true });
    expect((readJson(noFlag) as { error: { code: string } }).error.code).toBe("destructive_disabled");
    const noConfirm = await revokeApiKey(store, FLAGGED, { project: "site", key: "k1" });
    expect((readJson(noConfirm) as { error: { code: string } }).error.code).toBe("confirm_required");
    const memberCfg = { ...FLAGGED, identity: { email: "member@x.test" } };
    const member = await revokeApiKey(store, memberCfg, { project: "site", key: "k1", confirm: true });
    expect((readJson(member) as { error: { code: string } }).error.code).toBe("project_forbidden");
    const ownerCfg = { ...FLAGGED, identity: { email: "me@x.test" } };
    const ok = readJson(await revokeApiKey(store, ownerCfg, { project: "site", key: "k1", confirm: true })) as {
      revoked: string;
    };
    expect(ok.revoked).toBe("k1");
  });

  it("delete_project removes the workspace for owners with confirm", async () => {
    const { store } = seedStore();
    const memberCfg = { ...FLAGGED, identity: { email: "member@x.test" } };
    const denied = await deleteProject(store, memberCfg, { project: "site", confirm: true });
    expect((readJson(denied) as { error: { code: string } }).error.code).toBe("project_forbidden");
    const ownerCfg = { ...FLAGGED, identity: { email: "me@x.test" } };
    const ok = readJson(await deleteProject(store, ownerCfg, { project: "site", confirm: true })) as {
      deleted: string;
    };
    expect(ok.deleted).toBe("site");
    const gone = await getProject(store, OPEN_CONFIG, { project: "site" });
    expect((readJson(gone) as { error: { code: string } }).error.code).toBe("project_not_found");
  });

  it("rotate_project_secret returns a new sk once", async () => {
    const { store } = seedStore();
    const ownerCfg = { ...FLAGGED, identity: { email: "me@x.test" } };
    const out = readJson(await rotateProjectSecret(store, ownerCfg, { project: "site", confirm: true })) as {
      secret: string;
    };
    expect(out.secret).toMatch(/^sk_[0-9a-f]{64}$/);
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
    expect(utm.templates).toEqual([expect.objectContaining({ name: "Summer", source: "google" })]);
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
      "add_domain",
      "create_api_key",
      "create_funnel",
      "create_utm_template",
      "create_webhook",
      "delete_funnel",
      "delete_project",
      "delete_utm_template",
      "delete_webhook",
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
      "remove_domain",
      "revoke_api_key",
      "rotate_project_secret",
      "tracking_checkup",
      "update_funnel",
      "update_utm_template",
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
