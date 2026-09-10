import type { McpStore, McpProject } from "./store";
import type { McpConfig } from "./config";
import { McpError } from "./errors";

/** Resolve a workspace by id or slug, enforcing MCP_ALLOWED_SLUGS. */
export async function resolveProject(store: McpStore, config: McpConfig, ref: string): Promise<McpProject> {
  const trimmed = ref.trim();
  if (!trimmed) throw new McpError("invalid_input", "project is required (workspace slug or id)");
  // Slug first: findProjectById throws on non-UUID strings (Prisma validates
  // the column type client-side) instead of returning null.
  const bySlug = await store.findProjectBySlug(trimmed).catch(() => null);
  let found = bySlug;
  if (!found) {
    try {
      found = await store.findProjectById(trimmed);
    } catch {
      found = null;
    }
  }
  if (!found) throw new McpError("project_not_found", `workspace '${trimmed}' not found`);
  if (config.allowedSlugs && !config.allowedSlugs.includes(found.slug.toLowerCase())) {
    throw new McpError("project_forbidden", `workspace '${found.slug}' is not allowed for this MCP server`);
  }
  return found;
}

/** Gate for destructive tools: flag + explicit confirm required. */
export function requireDestructive(config: McpConfig, confirm: boolean | undefined, action: string): void {
  if (!config.allowDestructive) {
    throw new McpError(
      "destructive_disabled",
      `'${action}' is disabled: set MCP_ALLOW_DESTRUCTIVE=true to enable destructive tools`,
    );
  }
  if (confirm !== true) {
    throw new McpError("confirm_required", `'${action}' requires { "confirm": true }`);
  }
}

/** Split the stored comma-separated domain allowlist. */
export function parseDomains(stored: string): string[] {
  return stored
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}
