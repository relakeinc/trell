import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpStore } from "./store";
import type { McpConfig } from "./config";
import { parseDomains, resolveProject } from "./projects";
import { getProject, getProjectShape, listProjects } from "./tools/projects";
import { getStats, getStatsShape } from "./tools/stats";
import { trackingCheckup, trackingCheckupShape } from "./tools/tracking";
import {
  getBreakdown,
  getBreakdownShape,
  getForms,
  getFormsShape,
  getSeries,
  getSeriesShape,
  queryEvents,
  queryEventsShape,
} from "./tools/analytics";
import {
  getFunnel,
  getFunnelShape,
  listApiKeys,
  listFunnels,
  listUtmTemplates,
  listViews,
  listWebhooks,
  projectShape,
} from "./tools/entities";
import {
  addDomain,
  addDomainShape,
  createApiKey,
  createApiKeyShape,
  createFunnel,
  createFunnelShape,
  createUtmTemplate,
  createUtmTemplateShape,
  createWebhook,
  createWebhookShape,
  deleteFunnel,
  deleteFunnelShape,
  deleteUtmTemplate,
  deleteUtmTemplateShape,
  deleteWebhook,
  deleteWebhookShape,
  removeDomain,
  removeDomainShape,
  updateFunnel,
  updateFunnelShape,
  updateUtmTemplate,
  updateUtmTemplateShape,
  WRITE_ANNOTATIONS,
} from "./tools/writes";
import {
  deleteProject,
  deleteProjectShape,
  DESTRUCTIVE_ANNOTATIONS,
  revokeApiKey,
  revokeApiKeyShape,
  rotateProjectSecret,
  rotateProjectSecretShape,
} from "./tools/destructive";

export interface McpServerDeps {
  store: McpStore;
  config: McpConfig;
}

const READ_ONLY = { readOnlyHint: true } as const;

const EVENT_SCHEMA_TEXT = `Trell server-side event envelope (POST https://trepi.relake.co/v1/events, Bearer sk_...):
{
  "v": 1,
  "event_id": "uuid",
  "project": "pk_...",
  "type": "purchase | pageview | cta_click | <custom>",
  "ts": 1700000000000,
  "session_id": "…", "visitor_id": "…",
  "url": "https://example.com/checkout",
  "page": { "path": "/checkout", "title": "Checkout" },
  "referrer": "", "utm": null,
  "device": { "type": "desktop", "os": null, "browser": null, "viewport": [0, 0] },
  "properties": { "plan": "pro" }
}
Form events add: form { id, name? } (+ valid for form_submit, field+interaction for field_interaction).`;

/** Read-only tools (Phase 1 + Phase 2). */
export function createMcpServer(deps: McpServerDeps): McpServer {
  const { store, config } = deps;
  const server = new McpServer({ name: "trell", version: "0.0.0" });

  server.tool("list_projects", "List accessible Trell workspaces (id, slug, name, plan)", async () =>
    listProjects(store, config),
  );

  server.tool(
    "get_project",
    "Workspace detail: plan, publishable key, domain allowlist, creation date",
    getProjectShape,
    READ_ONLY,
    async (args) => getProject(store, config, args),
  );

  server.tool(
    "get_stats",
    "Event stats for a workspace: total, counts by type, top forms and pages (default: last 30 days, max range 366 days)",
    getStatsShape,
    READ_ONLY,
    async (args) => getStats(store, config, args),
  );

  server.tool(
    "tracking_checkup",
    "Check whether a workspace is receiving events, when the last one arrived, and whether the domain allowlist is open",
    trackingCheckupShape,
    READ_ONLY,
    async (args) => trackingCheckup(store, config, args),
  );

  server.tool(
    "get_series",
    "Time series of event counts (hour/day/week buckets, gap-filled)",
    getSeriesShape,
    READ_ONLY,
    async (args) => getSeries(store, config, args),
  );

  server.tool(
    "get_breakdown",
    "Break down events by dimension (page, utm_*, device, browser, os, form, type)",
    getBreakdownShape,
    READ_ONLY,
    async (args) => getBreakdown(store, config, args),
  );

  server.tool(
    "get_forms",
    "Form ranking with starts, successes and conversion rate (default: last 90 days)",
    getFormsShape,
    READ_ONLY,
    async (args) => getForms(store, config, args),
  );

  server.tool(
    "query_events",
    "Raw events, newest first, with cursor pagination (max 100 per call)",
    queryEventsShape,
    READ_ONLY,
    async (args) => queryEvents(store, config, args),
  );

  server.tool("list_funnels", "Funnel definitions of a workspace", projectShape, READ_ONLY, async (args) =>
    listFunnels(store, config, args),
  );

  server.tool("get_funnel", "One funnel definition by id or name", getFunnelShape, READ_ONLY, async (args) =>
    getFunnel(store, config, args),
  );

  server.tool("list_views", "Saved views of a workspace", projectShape, READ_ONLY, async (args) =>
    listViews(store, config, args),
  );

  server.tool(
    "list_webhooks",
    "Webhooks metadata (signing secrets are never exposed)",
    projectShape,
    READ_ONLY,
    async (args) => listWebhooks(store, config, args),
  );

  server.tool("list_utm_templates", "UTM templates of a workspace", projectShape, READ_ONLY, async (args) =>
    listUtmTemplates(store, config, args),
  );

  server.tool(
    "list_api_keys",
    "Server-key metadata: name, prefix, creation date (hashes and secrets are never exposed)",
    projectShape,
    READ_ONLY,
    async (args) => listApiKeys(store, config, args),
  );

  // ── Writes (member+) ───────────────────────────────────────
  server.tool("create_funnel", "Create a funnel", createFunnelShape, WRITE_ANNOTATIONS, async (args) =>
    createFunnel(store, config, args),
  );

  server.tool(
    "update_funnel",
    "Rename a funnel or replace its steps",
    updateFunnelShape,
    WRITE_ANNOTATIONS,
    async (args) => updateFunnel(store, config, args),
  );

  server.tool("delete_funnel", "Delete a funnel", deleteFunnelShape, WRITE_ANNOTATIONS, async (args) =>
    deleteFunnel(store, config, args),
  );

  server.tool("create_utm_template", "Create a UTM template", createUtmTemplateShape, WRITE_ANNOTATIONS, async (args) =>
    createUtmTemplate(store, config, args),
  );

  server.tool("update_utm_template", "Update a UTM template", updateUtmTemplateShape, WRITE_ANNOTATIONS, async (args) =>
    updateUtmTemplate(store, config, args),
  );

  server.tool("delete_utm_template", "Delete a UTM template", deleteUtmTemplateShape, WRITE_ANNOTATIONS, async (args) =>
    deleteUtmTemplate(store, config, args),
  );

  server.tool(
    "add_domain",
    "Add a hostname to the tracking allowlist",
    addDomainShape,
    WRITE_ANNOTATIONS,
    async (args) => addDomain(store, config, args),
  );

  server.tool(
    "remove_domain",
    "Remove a hostname from the tracking allowlist",
    removeDomainShape,
    WRITE_ANNOTATIONS,
    async (args) => removeDomain(store, config, args),
  );

  server.tool(
    "create_webhook",
    "Create a webhook (URL + subscribed events)",
    createWebhookShape,
    WRITE_ANNOTATIONS,
    async (args) => createWebhook(store, config, args),
  );

  server.tool("delete_webhook", "Delete a webhook", deleteWebhookShape, WRITE_ANNOTATIONS, async (args) =>
    deleteWebhook(store, config, args),
  );

  server.tool(
    "create_api_key",
    "Create a server key (secret shown ONCE — store it in .env, never in the browser)",
    createApiKeyShape,
    WRITE_ANNOTATIONS,
    async (args) => createApiKey(store, config, args),
  );

  // ── Destructive (owner + MCP_ALLOW_DESTRUCTIVE + confirm) ──
  server.tool(
    "revoke_api_key",
    "Revoke a server key immediately",
    revokeApiKeyShape,
    DESTRUCTIVE_ANNOTATIONS,
    async (args) => revokeApiKey(store, config, args),
  );

  server.tool(
    "delete_project",
    "PERMANENTLY delete a workspace and everything in it",
    deleteProjectShape,
    DESTRUCTIVE_ANNOTATIONS,
    async (args) => deleteProject(store, config, args),
  );

  server.tool(
    "rotate_project_secret",
    "Rotate the project-level secret (invalidates the old sk)",
    rotateProjectSecretShape,
    DESTRUCTIVE_ANNOTATIONS,
    async (args) => rotateProjectSecret(store, config, args),
  );

  // ── Resources ──────────────────────────────────────────────
  server.resource("projects", "trell://projects", async (uri) => {
    const all = await store.listProjects();
    const allowed = config.allowedSlugs ? all.filter((p) => config.allowedSlugs!.includes(p.slug.toLowerCase())) : all;
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({
            projects: allowed.map((p) => ({ id: p.id, slug: p.slug, name: p.name, plan: p.plan })),
          }),
        },
      ],
    };
  });

  server.resource(
    "usage",
    new ResourceTemplate("trell://projects/{slug}/usage", { list: undefined }),
    async (uri, { slug }) => {
      const p = await resolveProject(store, config, String(slug));
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 86_400_000);
      const events = await store.getEventsForAnalytics(p.id, { from, to: now });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({
              project: p.slug,
              plan: p.plan,
              eventsLast30d: events.length,
              domainsUsed: parseDomains(p.domains),
            }),
          },
        ],
      };
    },
  );

  server.resource("event-schema", "trell://schema/events", async (uri) => ({
    contents: [{ uri: uri.href, text: EVENT_SCHEMA_TEXT }],
  }));

  // ── Prompts ────────────────────────────────────────────────
  server.prompt(
    "weekly_report",
    "Weekly conversion report for a workspace (gathers stats, forms and tracking status)",
    { project: z.string().describe("Workspace slug or id") },
    async ({ project }: { project: string }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Generate a weekly conversion report for the Trell workspace "${project}".`,
              "1. Call tracking_checkup — if not connected, say so first and stop.",
              "2. Call get_stats for the last 7 days and for the previous 7 days; compare totals and byType.",
              "3. Call get_forms (last 30 days) and highlight the best/worst conversion rates.",
              "4. Call get_breakdown dimension=page (last 7 days) for the top converting pages.",
              "Keep it short, in the user's language, with concrete numbers and one suggested next action.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt("tracking_setup_help", "Checklist to verify tracking installation", async () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Help me verify my Trell tracking installation.",
            "1. Call tracking_checkup for my workspace.",
            "2. If no events: explain the browser snippet (Tracking page) and the data-trell-form-id attribute.",
            "3. If the domain allowlist is empty: explain the risk and how to add a domain in Settings → Domains.",
            "4. If events flow: summarize volume, last event time and top pages.",
          ].join("\n"),
        },
      },
    ],
  }));

  return server;
}
