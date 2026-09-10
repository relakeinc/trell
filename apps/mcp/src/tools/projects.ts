import { z } from "zod";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { runTool } from "../errors";
import { parseDomains, resolveProject } from "../projects";

export async function listProjects(store: McpStore, config: McpConfig) {
  return runTool(async () => {
    const all = await store.listProjects();
    const allowed = config.allowedSlugs
      ? all.filter((p) => config.allowedSlugs!.includes(p.slug.toLowerCase()))
      : all;
    return {
      projects: allowed.map((p) => ({ id: p.id, slug: p.slug, name: p.name, plan: p.plan })),
    };
  });
}

export const getProjectShape = {
  project: z.string().describe("Workspace slug or id"),
};

export async function getProject(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      plan: p.plan,
      // Publishable key is public by design (ships in the browser snippet).
      pk: p.publishableKey,
      domains: parseDomains(p.domains),
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    };
  });
}
