import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { runTool, McpError } from "../errors";
import { requireDestructive, resolveProject } from "../projects";
import { requireOwner } from "./writes";

const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;

const confirmShape = {
  confirm: z.boolean().describe("Must be true — acknowledges this cannot be undone"),
};

export const revokeApiKeyShape = {
  project: z.string().describe("Workspace slug or id"),
  key: z.string().describe("API key id"),
  ...confirmShape,
};

/** Revoke a server key. Owner-only + flag + confirm (kills live integrations). */
export async function revokeApiKey(
  store: McpStore,
  config: McpConfig,
  args: { project: string; key: string; confirm?: boolean },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    await requireOwner(store, config, p);
    requireDestructive(config, args.confirm, "revoke_api_key");
    const keys = await store.listApiKeys(p.id);
    const found = keys.find((k) => k.id === args.key.trim());
    if (!found) throw new McpError("invalid_input", `API key '${args.key}' not found in workspace '${p.slug}'`);
    await store.deleteApiKey(found.id);
    return { project: p.slug, revoked: found.id, name: found.name };
  });
}

export const deleteProjectShape = {
  project: z.string().describe("Workspace slug or id to PERMANENTLY delete"),
  ...confirmShape,
};

/** Delete a workspace and everything in it. Owner-only + flag + confirm. */
export async function deleteProject(store: McpStore, config: McpConfig, args: { project: string; confirm?: boolean }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    await requireOwner(store, config, p);
    requireDestructive(config, args.confirm, "delete_project");
    await store.deleteProject(p.id);
    return { deleted: p.slug };
  });
}

export const rotateProjectSecretShape = {
  project: z.string().describe("Workspace slug or id"),
  ...confirmShape,
};

/**
 * Rotate the project-level secret key. Owner-only + flag + confirm.
 * Invalidates the old sk immediately; named API keys are untouched.
 */
export async function rotateProjectSecret(
  store: McpStore,
  config: McpConfig,
  args: { project: string; confirm?: boolean },
) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    await requireOwner(store, config, p);
    requireDestructive(config, args.confirm, "rotate_project_secret");
    const secret = `sk_${randomBytes(32).toString("hex")}`;
    await store.rotateProjectSecret(p.id, createHash("sha256").update(secret, "utf8").digest("hex"));
    return {
      project: p.slug,
      secret,
      warning: "Copy the secret now — it is never shown again. Update every backend using the old sk immediately.",
    };
  });
}

export const DESTRUCTIVE_ANNOTATIONS = DESTRUCTIVE;
