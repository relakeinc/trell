export interface McpConfig {
  /** Lowercased slugs allowed. null = all workspaces. */
  allowedSlugs: string[] | null;
  /** Gate for destructive tools (revoke/delete/rotate). Default false. */
  allowDestructive: boolean;
  /** Bearer token for the HTTP transport (Phase 4). Empty = unset. */
  apiKey: string;
}

export function mcpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const raw = (env.MCP_ALLOWED_SLUGS ?? "*").trim();
  const allowedSlugs =
    raw === "" || raw === "*"
      ? null
      : raw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
  return {
    allowedSlugs,
    allowDestructive: env.MCP_ALLOW_DESTRUCTIVE === "true",
    apiKey: env.MCP_API_KEY ?? "",
  };
}
