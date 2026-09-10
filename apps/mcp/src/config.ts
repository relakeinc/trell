export interface McpConfig {
  /** Lowercased slugs allowed. null = all workspaces. */
  allowedSlugs: string[] | null;
  /** Gate for destructive tools (revoke/delete/rotate). Default false. */
  allowDestructive: boolean;
  /** Bearer token for the HTTP transport (Phase 4). Empty = unset. */
  apiKey: string;
  /**
   * Per-request caller identity (set by the HTTP listener from a verified
   * OAuth access token). null = service mode (legacy MCP_API_KEY).
   */
  identity?: { email: string } | null;
  /** Public base URL of this MCP server (issuer). */
  publicUrl: string;
  /** Google OAuth client (upstream identity). Empty = OAuth login disabled. */
  googleClientId: string;
  googleClientSecret: string;
  /** HMAC secret for our OAuth codes/tokens. Falls back to apiKey. */
  oauthSecret: string;
  /** Lowercased emails allowed to log in. null = any verified Google email. */
  allowedEmails: string[] | null;
}

function csvLower(raw: string | undefined): string[] | null {
  if (raw === undefined || raw.trim() === "") return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
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
    identity: null,
    publicUrl: (env.MCP_PUBLIC_URL ?? "https://mcp.relake.co").replace(/\/+$/, ""),
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    oauthSecret: env.MCP_OAUTH_SECRET || env.MCP_API_KEY || "",
    allowedEmails: env.MCP_ALLOWED_EMAILS !== undefined ? csvLower(env.MCP_ALLOWED_EMAILS) : null,
  };
}
