import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { signIdentityJwt } from "./chatIdentity";

/**
 * One MCP tool call with the webchat identity — no LLM involved.
 * Used by deterministic slash commands and @page context prefetch.
 */
export async function callChatTool(opts: {
  email: string;
  oauthSecret: string;
  mcpUrl: string;
  name: string;
  args: Record<string, unknown>;
}): Promise<unknown> {
  const mcp = new Client({ name: "trell-webchat", version: "0.0.0" });
  try {
    await mcp.connect(
      new StreamableHTTPClientTransport(new URL(opts.mcpUrl), {
        requestInit: { headers: { authorization: `Bearer ${signIdentityJwt(opts.email, opts.oauthSecret)}` } },
      }),
    );
    const out = await mcp.callTool({ name: opts.name, arguments: opts.args });
    const content = (out.content ?? []) as { type?: string; text?: string }[];
    const first = content.find((p) => p.type === "text" && p.text);
    if (!first?.text) return { ok: true };
    try {
      return JSON.parse(first.text) as unknown;
    } catch {
      return { text: first.text };
    }
  } finally {
    await mcp.close().catch(() => {});
  }
}
