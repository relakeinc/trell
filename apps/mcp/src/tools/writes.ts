import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { webhookUrlFormatError } from "@trell/shared";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { McpError, runTool } from "../errors";
import { getIdentityUser, resolveProject } from "../projects";

const WRITE = { readOnlyHint: false } as const;

function iso(d: Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/** Owner-only (service mode counts as operator and passes). */
export async function requireOwner(
  store: McpStore,
  config: McpConfig,
  project: { id: string; slug: string },
): Promise<void> {
  const user = await getIdentityUser(store, config);
  if (!user) return;
  const memberships = await store.listMemberships(user.id);
  if (memberships.find((m) => m.projectId === project.id)?.role !== "owner") {
    throw new McpError("project_forbidden", `only workspace owners can do this in '${project.slug}'`);
  }
}

const DOMAIN_RE = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  if (d.includes("://")) {
    try {
      d = new URL(d).hostname.toLowerCase();
    } catch {
      throw new McpError("invalid_input", `invalid domain: ${raw}`);
    }
  }
  d = (d.split("/")[0] ?? "").replace(/\.$/, "");
  if (!d) throw new McpError("invalid_input", "domain is required");
  if (d !== "localhost" && d !== "*.localhost" && !DOMAIN_RE.test(d)) {
    throw new McpError("invalid_input", `invalid domain (use a hostname like example.com): ${raw}`);
  }
  return d;
}

function cleanOpt(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// ── Funnels ────────────────────────────────────────────────

const funnelStepShape = z.object({
  eventType: z.string().min(1),
  formId: z.string().optional(),
  label: z.string().optional(),
});

export const createFunnelShape = {
  project: z.string().describe("Workspace slug or id"),
  name: z.string().min(1).max(64).describe("Funnel name"),
  steps: z.array(funnelStepShape).min(1).max(10).describe("Ordered steps"),
};

export async function createFunnel(
  store: McpStore,
  config: McpConfig,
  args: { project: string; name: string; steps: { eventType: string; formId?: string; label?: string }[] },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const name = args.name.trim();
    if (!name) throw new McpError("invalid_input", "name is required");
    const created = await store.createFunnel({
      projectId: p.id,
      name,
      steps: args.steps.map((s, i) => ({
        eventType: s.eventType,
        ...(s.formId ? { formId: s.formId } : {}),
        ...(s.label?.trim() ? { label: s.label.trim() } : {}),
        position: i,
      })),
    });
    return { project: p.slug, funnel: { id: created.id, name: created.name } };
  });
}

export const updateFunnelShape = {
  project: z.string().describe("Workspace slug or id"),
  funnel: z.string().describe("Funnel id"),
  name: z.string().min(1).max(64).optional().describe("New name"),
  steps: z.array(funnelStepShape).min(1).max(10).optional().describe("Replacement steps"),
};

async function resolveFunnel(store: McpStore, projectId: string, slug: string, ref: string) {
  const funnels = await store.listFunnels(projectId);
  const found = funnels.find((f) => f.id === ref.trim());
  if (!found) throw new McpError("invalid_input", `funnel '${ref}' not found in workspace '${slug}'`);
  return found;
}

export async function updateFunnel(
  store: McpStore,
  config: McpConfig,
  args: { project: string; funnel: string; name?: string; steps?: { eventType: string; formId?: string; label?: string }[] },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    await resolveFunnel(store, p.id, p.slug, args.funnel);
    const updates: { name?: string; steps?: { eventType: string; formId?: string; label?: string; position: number }[] } = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new McpError("invalid_input", "name cannot be empty");
      updates.name = args.name.trim();
    }
    if (args.steps !== undefined) {
      updates.steps = args.steps.map((s, i) => ({
        eventType: s.eventType,
        ...(s.formId ? { formId: s.formId } : {}),
        ...(s.label?.trim() ? { label: s.label.trim() } : {}),
        position: i,
      }));
    }
    const updated = await store.updateFunnel(args.funnel.trim(), updates);
    return { project: p.slug, funnel: { id: updated.id, name: updated.name } };
  });
}

export const deleteFunnelShape = {
  project: z.string().describe("Workspace slug or id"),
  funnel: z.string().describe("Funnel id"),
};

export async function deleteFunnel(store: McpStore, config: McpConfig, args: { project: string; funnel: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const found = await resolveFunnel(store, p.id, p.slug, args.funnel);
    await store.deleteFunnel(found.id);
    return { project: p.slug, deleted: found.id };
  });
}

// ── UTM templates ──────────────────────────────────────────

const utmFields = {
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  term: z.string().optional(),
  content: z.string().optional(),
  referral: z.string().optional(),
};

export const createUtmTemplateShape = {
  project: z.string().describe("Workspace slug or id"),
  name: z.string().min(1).max(64),
  ...utmFields,
};

export async function createUtmTemplate(
  store: McpStore,
  config: McpConfig,
  args: { project: string; name: string; source?: string; medium?: string; campaign?: string; term?: string; content?: string; referral?: string },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const name = args.name.trim();
    if (!name) throw new McpError("invalid_input", "name is required");
    const created = await store.createUtmTemplate({
      projectId: p.id,
      name,
      source: cleanOpt(args.source),
      medium: cleanOpt(args.medium),
      campaign: cleanOpt(args.campaign),
      term: cleanOpt(args.term),
      content: cleanOpt(args.content),
      referral: cleanOpt(args.referral),
    });
    return { project: p.slug, template: { id: created.id, name: created.name } };
  });
}

export const updateUtmTemplateShape = {
  project: z.string().describe("Workspace slug or id"),
  template: z.string().describe("Template id"),
  name: z.string().min(1).max(64).optional(),
  ...utmFields,
};

async function resolveUtm(store: McpStore, projectId: string, slug: string, ref: string) {
  const templates = await store.listUtmTemplates(projectId);
  const found = templates.find((t) => t.id === ref.trim());
  if (!found) throw new McpError("invalid_input", `UTM template '${ref}' not found in workspace '${slug}'`);
  return found;
}

export async function updateUtmTemplate(
  store: McpStore,
  config: McpConfig,
  args: { project: string; template: string; name?: string; source?: string; medium?: string; campaign?: string; term?: string; content?: string; referral?: string },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const found = await resolveUtm(store, p.id, p.slug, args.template);
    const input: Record<string, string | null> = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new McpError("invalid_input", "name cannot be empty");
      input.name = args.name.trim();
    }
    for (const k of ["source", "medium", "campaign", "term", "content", "referral"] as const) {
      if (args[k] !== undefined) input[k] = cleanOpt(args[k]);
    }
    const updated = await store.updateUtmTemplate(found.id, input);
    return { project: p.slug, template: { id: updated.id, name: updated.name } };
  });
}

export const deleteUtmTemplateShape = {
  project: z.string().describe("Workspace slug or id"),
  template: z.string().describe("Template id"),
};

export async function deleteUtmTemplate(store: McpStore, config: McpConfig, args: { project: string; template: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const found = await resolveUtm(store, p.id, p.slug, args.template);
    await store.deleteUtmTemplate(found.id);
    return { project: p.slug, deleted: found.id };
  });
}

// ── Domains ────────────────────────────────────────────────

export const addDomainShape = {
  project: z.string().describe("Workspace slug or id"),
  domain: z.string().min(1).describe("Hostname to allow (e.g. example.com)"),
};

export async function addDomain(store: McpStore, config: McpConfig, args: { project: string; domain: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const normalized = normalizeDomain(args.domain);
    const existing = p.domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    if (!existing.includes(normalized)) existing.push(normalized);
    const domains = await store.setProjectDomains(p.id, existing);
    return { project: p.slug, domains };
  });
}

export const removeDomainShape = {
  project: z.string().describe("Workspace slug or id"),
  domain: z.string().min(1).describe("Hostname to remove"),
};

export async function removeDomain(store: McpStore, config: McpConfig, args: { project: string; domain: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const target = normalizeDomain(args.domain);
    const existing = p.domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const domains = await store.setProjectDomains(
      p.id,
      existing.filter((d) => d.toLowerCase() !== target),
    );
    return { project: p.slug, domains };
  });
}

// ── Webhooks ───────────────────────────────────────────────

export const createWebhookShape = {
  project: z.string().describe("Workspace slug or id"),
  url: z.string().min(1).describe("https:// endpoint receiving POSTs"),
  events: z.array(z.string().min(1)).min(1).describe("Event types to subscribe"),
};

export async function createWebhook(
  store: McpStore,
  config: McpConfig,
  args: { project: string; url: string; events: string[] },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const url = args.url.trim();
    const formatError = webhookUrlFormatError(url);
    if (formatError) throw new McpError("invalid_input", formatError);
    const events = [...new Set(args.events.map((e) => e.trim()).filter(Boolean))];
    if (events.length === 0) throw new McpError("invalid_input", "events must not be empty");
    const created = await store.createWebhook({ projectId: p.id, url, events });
    return { project: p.slug, webhook: { id: created.id, url: created.url, events: created.events } };
  });
}

export const deleteWebhookShape = {
  project: z.string().describe("Workspace slug or id"),
  webhook: z.string().describe("Webhook id"),
};

export async function deleteWebhook(store: McpStore, config: McpConfig, args: { project: string; webhook: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const webhooks = await store.listWebhooks(p.id);
    const found = webhooks.find((w) => w.id === args.webhook.trim());
    if (!found) throw new McpError("invalid_input", `webhook '${args.webhook}' not found in workspace '${p.slug}'`);
    await store.deleteWebhook(found.id);
    return { project: p.slug, deleted: found.id };
  });
}

// ── Server keys ────────────────────────────────────────────

export const createApiKeyShape = {
  project: z.string().describe("Workspace slug or id"),
  name: z.string().min(1).max(64).describe("e.g. production server"),
};

export async function createApiKey(store: McpStore, config: McpConfig, args: { project: string; name: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const name = args.name.trim();
    if (!name) throw new McpError("invalid_input", "name is required");
    if (name.length > 64) throw new McpError("invalid_input", "name must be 64 characters or less");
    const secret = `sk_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(secret, "utf8").digest("hex");
    const created = await store.createApiKey({
      projectId: p.id,
      name,
      keyHash,
      keyPrefix: secret.slice(0, 11),
    });
    return {
      project: p.slug,
      key: { id: created.id, name: created.name },
      secret,
      warning: "Copy the secret now — it is never shown again. Store it as TRELL_SECRET_KEY in your backend .env, never in the browser.",
    };
  });
}

export const WRITE_ANNOTATIONS = WRITE;
