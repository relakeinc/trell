import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { callChatTool } from "@/lib/chatMcp";

export const runtime = "nodejs";

/** Deterministic slash commands: one MCP tool, zero LLM calls. */

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface TrackingResult {
  project?: string;
  connected?: boolean;
  lastEventAt?: string | null;
  totalEvents?: number;
  domains?: string[];
  findings?: string[];
}

function fmtTracking(r: TrackingResult): string {
  const lines = [`**Tracking — ${r.project ?? "workspace"}**`];
  lines.push(
    r.connected
      ? `Receiving events. Last: ${ago(r.lastEventAt ?? null)}. Total: ${r.totalEvents ?? 0}.`
      : "Not receiving events yet — paste the browser snippet from Tracking.",
  );
  if (r.domains && r.domains.length > 0) lines.push(`Allowlist: ${r.domains.join(", ")}`);
  for (const f of r.findings ?? []) lines.push(`- ${f}`);
  return lines.join("\n");
}

interface RecentEvent {
  type?: string;
  ts?: string;
  pagePath?: string | null;
  formId?: string | null;
  formName?: string | null;
}

interface RecentResult {
  events?: RecentEvent[];
  total?: number;
}

function fmtRecent(r: RecentResult): string {
  const events = (r.events ?? []).slice(0, 8);
  if (events.length === 0) return "No events in the last 30 days.";
  const lines = [`**Latest events (${r.total ?? events.length} in 30d)**`];
  for (const e of events) {
    const where = e.formId ?? e.pagePath ?? "";
    lines.push(`- ${ago(e.ts ?? null)} — ${e.type ?? "event"}${where ? ` ${where}` : ""}`);
  }
  return lines.join("\n");
}

interface StatsResult {
  total?: number;
  byType?: Record<string, number>;
  topPages?: { key: string; count: number }[];
  topForms?: { key: string; count: number }[];
}

function fmtStats(r: StatsResult): string {
  const lines = ["**Stats — last 30 days**", `Total events: ${r.total ?? 0}`];
  const types = Object.entries(r.byType ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (types.length > 0) {
    lines.push("By type:");
    for (const [t, n] of types) lines.push(`- ${t}: ${n}`);
  }
  if ((r.topPages ?? []).length > 0) {
    lines.push("Top pages:");
    for (const p of r.topPages!.slice(0, 5)) lines.push(`- ${p.key}: ${p.count}`);
  }
  return lines.join("\n");
}

const COMMANDS: Record<
  string,
  { tool: string; args: (slug: string) => Record<string, unknown>; fmt: (r: unknown) => string }
> = {
  tracking: {
    tool: "tracking_checkup",
    args: (slug) => ({ project: slug }),
    fmt: (r) => fmtTracking(r as TrackingResult),
  },
  recent: {
    tool: "query_events",
    args: (slug) => ({ project: slug, limit: 8 }),
    fmt: (r) => fmtRecent(r as RecentResult),
  },
  stats: { tool: "get_stats", args: (slug) => ({ project: slug }), fmt: (r) => fmtStats(r as StatsResult) },
};

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
  let command = "";
  try {
    const body = (await req.json()) as { slug?: unknown; command?: unknown };
    if (typeof body.slug === "string") slug = body.slug.trim();
    if (typeof body.command === "string") command = body.command.trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
  }
  const def = COMMANDS[command];
  if (!slug || !def) {
    console.error("[chat:command] rejected", { hasSlug: !!slug, command: command || "(empty)" });
    return new Response(JSON.stringify({ error: "unknown command" }), { status: 400 });
  }
  try {
    const data = await callChatTool({ email, oauthSecret, mcpUrl, name: def.tool, args: def.args(slug) });
    return new Response(JSON.stringify({ text: def.fmt(data) }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[chat:command] failed", {
      command,
      message: (e instanceof Error ? e.message : String(e)).slice(0, 300),
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "command failed" }), {
      status: 502,
    });
  }
}
