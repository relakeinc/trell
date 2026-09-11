import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth } from "@/lib/auth";
import { signIdentityJwt } from "@/lib/chatIdentity";
import { buildSystemPrompt, parseChatBody, toFunctionDeclarations, toGeminiContents } from "@/lib/chatAgent";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TURNS = 6;

// listTools rarely changes: cache declarations briefly to skip one MCP
// round-trip per message. Only successful fetches are cached.
type Declarations = ReturnType<typeof toFunctionDeclarations>;
let declarationsCache: { at: number; value: Declarations } | null = null;
const DECLARATIONS_TTL_MS = 5 * 60 * 1000;

type SSE
  = { t: "text"; d: string }
  | { t: "status"; d: string }
  | { t: "thought"; d: string }
  | { t: "tool"; name: string; state: "input-available" | "output-available" | "output-error" }
  | { t: "done" }
  | { t: "error"; d: string };

function send(controller: ReadableStreamDefaultController<string>, msg: SSE): void {
  controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`);
}

function statusOf(e: unknown): number | null {
  if (e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number") {
    return (e as { status: number }).status;
  }
  return null;
}

function isThinkingError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /think/i.test(msg) && statusOf(e) !== null;
}

function isCapacityError(e: unknown): boolean {
  const status = statusOf(e);
  if (status === 404 || status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /NOT_FOUND|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg);
}

function friendlyError(e: unknown, model: string): string {
  const status = statusOf(e);
  if (status === 429) return "Free model limit reached, try again in a bit.";
  if (status === 404) return `Model ${model} is not available on your account. Try GEMINI_MODEL=another-model.`;
  if (e instanceof Error && e.message.length < 200) return e.message;
  return "Chat failed, try again.";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!session?.user?.id || !email) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const oauthSecret = process.env.MCP_OAUTH_SECRET ?? "";
  const mcpUrl = process.env.MCP_URL ?? "http://api:8788";
  const primaryModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";
  if (!apiKey || !oauthSecret) {
    return new Response(JSON.stringify({ error: "chat_not_configured" }), { status: 503 });
  }

  let history;
  let slug = "dashboard";
  let mode: "ask" | "do" = "ask";
  try {
    const body = (await req.json()) as { messages?: unknown; slug?: unknown; mode?: unknown };
    history = parseChatBody(body);
    if (typeof body.slug === "string" && body.slug.trim()) slug = body.slug.trim();
    if (body.mode === "do") mode = "do";
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "bad request" }), { status: 400 });
  }
  const stream = new ReadableStream<string>({
    async start(controller) {
      const mcp = new Client({ name: "trell-webchat", version: "0.0.0" });
      let model = primaryModel;
      try {
        const jwt = signIdentityJwt(email, oauthSecret);
        await mcp.connect(
          new StreamableHTTPClientTransport(new URL(mcpUrl), {
            requestInit: { headers: { authorization: `Bearer ${jwt}` } },
          }),
        );
        let declarations = declarationsCache && Date.now() - declarationsCache.at < DECLARATIONS_TTL_MS
          ? declarationsCache.value
          : null;
        if (!declarations) {
          const { tools } = await mcp.listTools();
          declarations = toFunctionDeclarations(
            tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })),
          );
          declarationsCache = { at: Date.now(), value: declarations };
        }

        const ai = new GoogleGenAI({ apiKey });
        const contents = toGeminiContents(history).map((c) => ({ ...c })) as { role: string; parts: unknown[] }[];
        const systemInstruction = buildSystemPrompt({ workspaceSlug: slug, userEmail: email, mode });
        let fellBack = false;
        let thinkingOff = false;

        interface RawPart { text?: string; thought?: boolean }
        interface RawChunk {
          text?: string;
          functionCalls?: { name: string; args: Record<string, unknown>; id?: string }[];
          candidates?: { content?: { parts?: RawPart[] } }[];
        }

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          let response;
          try {
            response = await ai.models.generateContentStream({
              model,
              contents: contents as never,
              config: {
                systemInstruction,
                tools: [{ functionDeclarations: declarations as never }],
                maxOutputTokens: 2048,
                temperature: 0.3,
                ...(thinkingOff ? {} : { thinkingConfig: { includeThoughts: true } }),
              },
            });
          } catch (e) {
            // Free-tier models come and go: retry once with the fallback.
            if (!fellBack && model !== fallbackModel && isCapacityError(e)) {
              fellBack = true;
              model = fallbackModel;
              send(controller, { t: "status", d: `Switching to fallback model (${fallbackModel})…` });
              turn--;
              continue;
            }
            // Model rejects thinking blocks: retry once without them.
            if (!thinkingOff && isThinkingError(e)) {
              thinkingOff = true;
              turn--;
              continue;
            }
            throw e;
          }

          let text = "";
          let calls: { name: string; args: Record<string, unknown>; id?: string }[] = [];
          for await (const chunk of response) {
            const c = chunk as unknown as RawChunk;
            if (!thinkingOff) {
              const parts = c.candidates?.[0]?.content?.parts ?? [];
              let thought = "";
              for (const p of parts) {
                if (typeof p?.text === "string" && p.text && p.thought === true) thought += p.text;
              }
              if (thought) send(controller, { t: "thought", d: thought });
            }
            if (c.text) {
              text += c.text;
              send(controller, { t: "text", d: c.text });
            }
            if (c.functionCalls && c.functionCalls.length > 0) calls = c.functionCalls;
          }

          if (calls.length === 0) break;

          const responseParts: unknown[] = [];
          if (text) responseParts.push({ text });
          for (const call of calls) {
            const callArgs = (call.args ?? {}) as Record<string, unknown>;
            send(controller, { t: "tool", name: call.name, state: "input-available" });
            let result: unknown;
            let toolOk = true;
            try {
              const out = await mcp.callTool({ name: call.name, arguments: callArgs });
              const content = (out.content ?? []) as { type?: string; text?: string }[];
              const first = content.find((p) => p.type === "text" && p.text);
              result = first?.text ? (JSON.parse(first.text) as unknown) : { ok: true };
            } catch (e) {
              toolOk = false;
              result = { error: e instanceof Error ? e.message : "tool failed" };
            }
            send(controller, { t: "tool", name: call.name, state: toolOk ? "output-available" : "output-error" });
            responseParts.push({ functionResponse: { name: call.name, response: { result } } });
          }
          contents.push({ role: "model", parts: responseParts });
          if (turn === MAX_TURNS - 1) {
            send(controller, { t: "text", d: "\n\n(I've reached the step limit; ask to continue if anything is missing.)" });
          }
        }
        send(controller, { t: "done" });
      } catch (e) {
        send(controller, { t: "error", d: friendlyError(e, model) });
      } finally {
        controller.close();
        await mcp.close().catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
  });
}
