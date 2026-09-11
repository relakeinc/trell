import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { CHAT_PAGES } from "@/lib/chatAgent";
import { callChatTool } from "@/lib/chatMcp";

export const runtime = "nodejs";

const PAGE_TOOLS: Record<string, string> = {
  analytics: "get_stats",
  events: "query_events",
  funnels: "list_funnels",
  forms: "get_forms",
  tracking: "tracking_checkup",
  project: "get_project",
};

/** Prefetch one MCP snapshot for an @page mention. No LLM calls. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!session?.user?.id || !email) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const oauthSecret = process.env.MCP_OAUTH_SECRET ?? "";
  const mcpUrl = process.env.MCP_URL ?? "http://api:8788";
  if (!oauthSecret) {
    return new Response(JSON.stringify({ error: "chat_not_configured" }), { status: 503 });
  }
  let slug = "";
  let page = "";
  try {
    const body = (await req.json()) as { slug?: unknown; page?: unknown };
    if (typeof body.slug === "string") slug = body.slug.trim();
    if (typeof body.page === "string") page = body.page.trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
  }
  const tool = PAGE_TOOLS[page];
  const label = CHAT_PAGES.find((p) => p.id === page)?.label ?? page;
  if (!slug || !tool) {
    console.error("[chat:context] rejected", { hasSlug: !!slug, page: page || "(empty)" });
    return new Response(JSON.stringify({ error: "unknown page" }), { status: 400 });
  }
  try {
    const data = await callChatTool({
      email,
      oauthSecret,
      mcpUrl,
      name: tool,
      args: { project: slug, ...(page === "events" ? { limit: 8 } : {}) },
    });
    return new Response(JSON.stringify({ label, data }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[chat:context] failed", {
      page,
      message: (e instanceof Error ? e.message : String(e)).slice(0, 300),
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "context failed" }), {
      status: 502,
    });
  }
}
