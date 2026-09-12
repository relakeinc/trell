import { z } from "zod";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { McpError, runTool } from "../errors";
import { resolveProject } from "../projects";

const projectShape = {
  project: z.string().describe("Workspace slug or id"),
};

export { projectShape };

function iso(d: Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export async function listFunnels(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const funnels = await store.listFunnels(p.id);
    return {
      project: p.slug,
      funnels: funnels.map((f) => ({
        id: f.id,
        name: f.name,
        steps: f.steps.map((s) => ({ eventType: s.eventType, formId: s.formId, label: s.label, position: s.position })),
        createdAt: iso(f.createdAt),
        updatedAt: iso(f.updatedAt),
      })),
    };
  });
}

export const getFunnelShape = {
  project: z.string().describe("Workspace slug or id"),
  funnel: z.string().describe("Funnel id or name"),
};

export async function getFunnel(store: McpStore, config: McpConfig, args: { project: string; funnel: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const funnels = await store.listFunnels(p.id);
    const needle = args.funnel.trim().toLowerCase();
    const found =
      funnels.find((f) => f.id === args.funnel.trim()) ?? funnels.find((f) => f.name.toLowerCase() === needle);
    if (!found) throw new McpError("invalid_input", `funnel '${args.funnel}' not found in workspace '${p.slug}'`);
    return {
      project: p.slug,
      funnel: {
        id: found.id,
        name: found.name,
        steps: found.steps.map((s) => ({
          eventType: s.eventType,
          formId: s.formId,
          label: s.label,
          position: s.position,
        })),
        createdAt: iso(found.createdAt),
        updatedAt: iso(found.updatedAt),
      },
    };
  });
}

export async function listViews(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const views = await store.listSavedViews(p.id);
    return {
      project: p.slug,
      views: views.map((v) => ({ id: v.id, name: v.name, type: v.type, createdAt: iso(v.createdAt) })),
    };
  });
}

export async function listWebhooks(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const webhooks = await store.listWebhooks(p.id);
    return {
      project: p.slug,
      // Signing secrets are never exposed.
      webhooks: webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        enabled: w.enabled,
        createdAt: iso(w.createdAt),
      })),
    };
  });
}

export async function listUtmTemplates(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const templates = await store.listUtmTemplates(p.id);
    return {
      project: p.slug,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        source: t.source,
        medium: t.medium,
        campaign: t.campaign,
        term: t.term,
        content: t.content,
        referral: t.referral,
        createdAt: iso(t.createdAt),
      })),
    };
  });
}

export async function listApiKeys(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const keys = await store.listApiKeys(p.id);
    return {
      project: p.slug,
      // Hashes and secrets are never exposed — only display metadata.
      keys: keys.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, createdAt: iso(k.createdAt) })),
    };
  });
}
