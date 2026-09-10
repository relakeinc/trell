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

type SSE = { t: "text"; d: string } | { t: "status"; d: string } | { t: "done" } | { t: "error"; d: string };

function send(controller: ReadableStreamDefaultController<string>, msg: SSE): void {
  controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`);
}

function statusOf(e: unknown): number | null {
  if (e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number") {
    return (e as { status: number }).status;
  }
  return null;
}

function isCapacityError(e: unknown): boolean {
  const status = statusOf(e);
  if (status === 404 || status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /NOT_FOUND|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg);
}

function friendlyError(e: unknown, model: string): string {
  const status = statusOf(e);
  if (status === 429) return "Límite del modelo gratis alcanzado, intenta de nuevo en un rato.";
  if (status === 404) return `El modelo ${model} no está disponible en tu cuenta. Prueba con GEMINI_MODEL=otro-modelo.`;
  if (e instanceof Error && e.message.length < 200) return e.message;
  return "El chat falló, intenta de nuevo.";
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
        const { tools } = await mcp.listTools();
        const declarations = toFunctionDeclarations(
          tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })),
        );

        const ai = new GoogleGenAI({ apiKey });
        const contents = toGeminiContents(history).map((c) => ({ ...c })) as { role: string; parts: unknown[] }[];
        const systemInstruction = buildSystemPrompt({ workspaceSlug: slug, userEmail: email, mode });
        let fellBack = false;

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
              },
            });
          } catch (e) {
            // Free-tier models come and go: retry once with the fallback.
            if (!fellBack && model !== fallbackModel && isCapacityError(e)) {
              fellBack = true;
              model = fallbackModel;
              send(controller, { t: "status", d: "Cambiando a modelo alternativo…" });
              turn--;
              continue;
            }
            throw e;
          }

          let text = "";
          let calls: { name: string; args: Record<string, unknown>; id?: string }[] = [];
          for await (const chunk of response) {
            const c = chunk as unknown as { text?: string; functionCalls?: { name: string; args: Record<string, unknown>; id?: string }[] };
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
            send(controller, { t: "status", d: `Consultando ${call.name}…` });
            let result: unknown;
            try {
              const out = await mcp.callTool({ name: call.name, arguments: (call.args ?? {}) as Record<string, unknown> });
              const content = (out.content ?? []) as { type?: string; text?: string }[];
              const first = content.find((p) => p.type === "text" && p.text);
              result = first?.text ? (JSON.parse(first.text) as unknown) : { ok: true };
            } catch (e) {
              result = { error: e instanceof Error ? e.message : "tool failed" };
            }
            responseParts.push({ functionResponse: { name: call.name, response: { result } } });
          }
          contents.push({ role: "model", parts: responseParts });
          if (turn === MAX_TURNS - 1) {
            send(controller, { t: "text", d: "\n\n(He llegado al límite de pasos; pide continuar si falta algo.)" });
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
