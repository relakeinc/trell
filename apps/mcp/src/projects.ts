import type { McpStore, McpProject, McpUser } from "./store";
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
  const ids = await identityProjectIds(store, config);
  if (ids && !ids.has(found.id)) {
    throw new McpError("project_forbidden", `workspace '${found.slug}' is not in your account`);
  }
  return found;
}

/**
 * Caller identity from a verified OAuth login. null = service mode
 * (legacy MCP_API_KEY): no per-user scoping, allowlist only.
 */
export async function getIdentityUser(store: McpStore, config: McpConfig): Promise<McpUser | null> {
  const email = config.identity?.email?.trim().toLowerCase();
  if (!email) return null;
  if (config.allowedEmails && !config.allowedEmails.includes(email)) {
    throw new McpError("project_forbidden", "this login is not allowed on this MCP server");
  }
  const user = await store.findUserByEmail(email);
  if (!user) throw new McpError("project_forbidden", "no Trell account exists for this login");
  return user;
}

/** Project ids the caller may access, or null in service mode (no scoping). */
export async function identityProjectIds(store: McpStore, config: McpConfig): Promise<Set<string> | null> {
  const user = await getIdentityUser(store, config);
  if (!user) return null;
  const memberships = await store.listMemberships(user.id);
  return new Set(memberships.map((m) => m.projectId));
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
