import { NextRequest } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth } from "@/lib/auth";
import { signIdentityJwt } from "@/lib/chatIdentity";
import {
  answerLocalIntent,
  buildSystemPrompt,
  parseChatBody,
  parseOpenAIChunk,
  toDisplayOutput,
  toFunctionDeclarations,
  toOpenAIMessages,
  toOpenAITools,
  type OpenAIFunctionTool,
  type OpenAIMessage,
} from "@/lib/chatAgent";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TURNS = 6;
const MAX_TOOL_RESULT_CHARS = 8000;

// listTools rarely changes: cache declarations briefly to skip one MCP round-trip per message.
type Declarations = ReturnType<typeof toFunctionDeclarations>;
let declarationsCache: { at: number; value: Declarations } | null = null;
const DECLARATIONS_TTL_MS = 5 * 60 * 1000;

// Skip the doomed primary attempt for a while after it 429s/404s; each failed attempt costs a round-trip.
let primaryCoolDownUntil = 0;
const PRIMARY_COOLDOWN_429_MS = 10 * 60 * 1000;
const PRIMARY_COOLDOWN_404_MS = 60 * 60 * 1000;

type SSE =
  | { t: "text"; d: string }
  | { t: "status"; d: string }
  | { t: "thought"; d: string }
  | {
      t: "tool";
      name: string;
      state: "input-available" | "output-available" | "output-error";
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      errorText?: string;
    }
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

function httpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

function isCapacityError(e: unknown): boolean {
  const status = statusOf(e);
  if (status === 402 || status === 404 || status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /quota|rate limit|insufficient|credit/i.test(msg);
}

function isReasoningError(e: unknown): boolean {
  if (statusOf(e) !== 400) return false;
  const msg = e instanceof Error ? e.message : String(e);
  return /reasoning/i.test(msg);
}

function friendlyError(e: unknown, model: string): string {
  const status = statusOf(e);
  if (status === 429) return "Free model limit reached, try again in a bit.";
  if (status === 402) return "OpenRouter credits exhausted. Free models need no credits — check your account.";
  if (status === 404) return `Model ${model} is not available. Check the provider model env.`;
  if (e instanceof Error && e.message.length < 200) return e.message;
  return "Chat failed, try again.";
}

async function postChatCompletions(args: {
  provider: { baseUrl: string; apiKey: string; model: string };
  origin: string;
  messages: OpenAIMessage[];
  tools: OpenAIFunctionTool[];
  reasoningOff: boolean;
}): Promise<Response> {
  const body: Record<string, unknown> = {
    model: args.provider.model,
    messages: args.messages,
    tools: args.tools,
    temperature: 0.3,
    max_tokens: 1024,
    stream: true,
  };
  if (!args.reasoningOff) body.reasoning = { effort: "medium" };
  const res = await fetch(`${args.provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.provider.apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": args.origin,
      "X-Title": "Yoi",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let msg = `OpenRouter ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: unknown } };
      if (j?.error && typeof j.error.message === "string" && j.error.message) {
        msg = j.error.message.slice(0, 300);
      }
    } catch {}
    throw httpError(res.status, msg);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!session?.user?.id || !email) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const oauthSecret = process.env.MCP_OAUTH_SECRET ?? "";
  const mcpUrl = process.env.MCP_URL ?? "http://api:8788";
  const primary = {
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  };
  const fallback = {
    baseUrl: process.env.ORCAROUTER_BASE_URL ?? "https://api.orcarouter.ai/v1",
    apiKey: process.env.ORCAROUTER_API_KEY ?? "",
    model: process.env.ORCAROUTER_FALLBACK_MODEL ?? "orcarouter/free",
  };
  if (!primary.apiKey || !oauthSecret) {
    return new Response(JSON.stringify({ error: "chat_not_configured" }), { status: 503 });
  }
  const canFallBack = !!fallback.apiKey && fallback.model !== primary.model;

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
  // Small talk never touches MCP or the model: instant canned reply.
  const local = answerLocalIntent(history[history.length - 1]!.text);
  if (local) {
    const sseHeaders = {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "X-Accel-Buffering": "no",
    };
    const body = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(`data: ${JSON.stringify({ t: "text", d: local })}\n\n`);
        controller.enqueue(`data: ${JSON.stringify({ t: "done" })}\n\n`);
        controller.close();
      },
    });
    return new Response(body, { headers: sseHeaders });
  }
  const stream = new ReadableStream<string>({
    async start(controller) {
      const mcp = new Client({ name: "trell-webchat", version: "0.0.0" });
      let provider = primary;
      let fellBack = false;
      if (canFallBack && Date.now() < primaryCoolDownUntil) {
        provider = fallback;
        fellBack = true;
      }
      try {
        const jwt = signIdentityJwt(email, oauthSecret);
        await mcp.connect(
          new StreamableHTTPClientTransport(new URL(mcpUrl), {
            requestInit: { headers: { authorization: `Bearer ${jwt}` } },
          }),
        );
        let declarations =
          declarationsCache && Date.now() - declarationsCache.at < DECLARATIONS_TTL_MS ? declarationsCache.value : null;
        if (!declarations) {
          const { tools } = await mcp.listTools();
          declarations = toFunctionDeclarations(
            tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema as Record<string, unknown>,
            })),
          );
          declarationsCache = { at: Date.now(), value: declarations };
        }
        const tools = toOpenAITools(declarations);

        const messages = toOpenAIMessages(
          buildSystemPrompt({
            workspaceSlug: slug,
            userEmail: email,
            mode,
            today: new Date().toISOString().slice(0, 10),
          }),
          history,
        );
        const origin = req.nextUrl.origin;
        let reasoningOff = false;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          let res: Response;
          try {
            res = await postChatCompletions({ provider, origin, messages, tools, reasoningOff });
          } catch (e) {
            // Free-tier models come and go: retry once with the fallback.
            if (!fellBack && canFallBack && isCapacityError(e)) {
              const st = statusOf(e);
              if (st === 429) primaryCoolDownUntil = Date.now() + PRIMARY_COOLDOWN_429_MS;
              else if (st === 404) primaryCoolDownUntil = Date.now() + PRIMARY_COOLDOWN_404_MS;
              fellBack = true;
              provider = fallback;
              send(controller, { t: "status", d: `Switching to fallback (${fallback.model})…` });
              turn--;
              continue;
            }
            // Provider rejects the reasoning param: retry once without it.
            if (!reasoningOff && isReasoningError(e)) {
              reasoningOff = true;
              turn--;
              continue;
            }
            throw e;
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let text = "";
          const pending = new Map<number, { id: string; name: string; args: string }>();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              let data: unknown;
              try {
                data = JSON.parse(payload);
              } catch {
                continue;
              }
              const delta = parseOpenAIChunk(data);
              if (!delta) continue;
              if (delta.reasoning) {
                send(controller, { t: "thought", d: delta.reasoning });
              }
              if (delta.content) {
                text += delta.content;
                send(controller, { t: "text", d: delta.content });
              }
              for (const td of delta.toolDeltas) {
                const p = pending.get(td.index) ?? { id: "", name: "", args: "" };
                if (td.id) p.id = td.id;
                if (td.name) p.name = td.name;
                if (td.args) p.args += td.args;
                pending.set(td.index, p);
              }
            }
          }

          const calls: { name: string; args: Record<string, unknown>; id: string }[] = [];
          let callIdx = 0;
          for (const p of pending.values()) {
            if (!p.name) continue;
            let args: Record<string, unknown> = {};
            if (p.args) {
              try {
                args = JSON.parse(p.args) as Record<string, unknown>;
              } catch {
                throw httpError(502, "Model returned invalid tool arguments");
              }
            }
            calls.push({ name: p.name, args, id: p.id || `call_${turn}_${callIdx++}` });
          }

          if (calls.length === 0) break;

          messages.push({
            role: "assistant",
            content: text,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: JSON.stringify(c.args) },
            })),
          });
          for (const call of calls) {
            const callArgs = call.args;
            send(controller, { t: "tool", name: call.name, state: "input-available", input: callArgs });
            let result: unknown;
            let toolOk = true;
            let toolErr = "";
            try {
              const out = await mcp.callTool({ name: call.name, arguments: callArgs });
              const content = (out.content ?? []) as { type?: string; text?: string }[];
              const first = content.find((p) => p.type === "text" && p.text);
              result = first?.text ? (JSON.parse(first.text) as unknown) : { ok: true };
            } catch (e) {
              toolOk = false;
              toolErr = (e instanceof Error ? e.message : "tool failed").slice(0, 300);
              result = { error: toolErr };
            }
            send(controller, {
              t: "tool",
              name: call.name,
              state: toolOk ? "output-available" : "output-error",
              output: toDisplayOutput(result),
              ...(toolOk ? {} : { errorText: toolErr || "tool failed" }),
            });
            const resultText = JSON.stringify(result) ?? "";
            messages.push({
              role: "tool",
              content:
                resultText.length > MAX_TOOL_RESULT_CHARS
                  ? `${resultText.slice(0, MAX_TOOL_RESULT_CHARS)}… (truncated)`
                  : resultText,
              tool_call_id: call.id,
            });
          }
          if (turn === MAX_TURNS - 1) {
            send(controller, {
              t: "text",
              d: "\n\n(I've reached the step limit; ask to continue if anything is missing.)",
            });
          }
        }
        send(controller, { t: "done" });
      } catch (e) {
        console.error("[chat] request failed", {
          model: provider.model,
          status: statusOf(e),
          message: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        });
        send(controller, { t: "error", d: friendlyError(e, provider.model) });
      } finally {
        controller.close();
        await mcp.close().catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
