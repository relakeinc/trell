export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

const MAX_HISTORY = 20;

export function buildSystemPrompt(opts: { workspaceSlug: string; userEmail: string; mode?: "ask" | "do" }): string {
  const modeLine =
    opts.mode === "do"
      ? "Mode DO: act directly with tools (still confirm destructive actions first)."
      : "Mode ASK: answer questions and propose actions, execute only what the user explicitly asks.";
  return [
    `You are Ask Trell, the in-dashboard assistant for the Trell workspace "${opts.workspaceSlug}".`,
    `You talk to ${opts.userEmail}. Reply in the user's language (default Spanish if unclear). Be concise.`,
    modeLine,
    "You have read-only AND write tools (funnels, UTM, domains, webhooks, API keys).",
    "Rules:",
    "- Never invent numbers: always call a tool first when asked about data.",
    "- Prefer the current workspace unless the user names another one they belong to.",
    "- For destructive actions (revoke key, delete workspace, rotate secret) explain the consequence and ask for explicit confirmation BEFORE calling — the tool itself also requires confirm:true.",
    "- Secrets are shown once by the tools; tell the user to save them in .env immediately.",
    "- Never use emojis unless the user explicitly asks for them.",
    "- If a tool errors, explain it plainly and suggest the fix.",
  ].join("\n");
}

/** Client history → OpenAI-compatible messages with system prompt first. */
export function toOpenAIMessages(system: string, messages: ChatMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: "system", content: system }];
  for (const m of messages.filter((m) => m.text.trim().length > 0).slice(-MAX_HISTORY)) {
    out.push(m.role === "model" ? { role: "assistant", content: m.text } : { role: "user", content: m.text });
  }
  return out;
}

export interface OpenAIFunctionTool {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

/** Declarations → OpenAI-compatible tools (OpenRouter). Parameters always present. */
export function toOpenAITools(decls: GeminiFunctionDeclaration[]): OpenAIFunctionTool[] {
  return decls.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      ...(d.description ? { description: d.description } : {}),
      parameters:
        d.parameters && Object.keys(d.parameters).length > 0 ? d.parameters : { type: "object", properties: {} },
    },
  }));
}

export interface OpenAIToolDelta {
  index: number;
  id: string;
  name: string;
  args: string;
}

export interface OpenAIChunk {
  content: string;
  reasoning: string;
  toolDeltas: OpenAIToolDelta[];
}

/**
 * Normalize one parsed OpenAI-compat streaming chunk. Accepts both
 * `reasoning` and `reasoning_content` delta fields. Null when not a
 * choice delta (usage payloads, errors, garbage).
 */
export function parseOpenAIChunk(data: unknown): OpenAIChunk | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  if (!first || typeof first !== "object") return null;
  const delta = (first as { delta?: unknown }).delta;
  if (!delta || typeof delta !== "object") return null;
  const d = delta as {
    content?: unknown;
    reasoning?: unknown;
    reasoning_content?: unknown;
    tool_calls?: unknown;
  };
  const content = typeof d.content === "string" ? d.content : "";
  const reasoning =
    typeof d.reasoning === "string"
      ? d.reasoning
      : typeof d.reasoning_content === "string"
        ? d.reasoning_content
        : "";
  const toolDeltas: OpenAIToolDelta[] = [];
  if (Array.isArray(d.tool_calls)) {
    d.tool_calls.forEach((t, i) => {
      if (!t || typeof t !== "object") return;
      const tt = t as { index?: unknown; id?: unknown; function?: unknown };
      const fn = (tt.function ?? {}) as { name?: unknown; arguments?: unknown };
      toolDeltas.push({
        index: typeof tt.index === "number" ? tt.index : i,
        id: typeof tt.id === "string" ? tt.id : "",
        name: typeof fn.name === "string" ? fn.name : "",
        args: typeof fn.arguments === "string" ? fn.arguments : "",
      });
    });
  }
  return { content, reasoning, toolDeltas };
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/** MCP tool schemas → Gemini function declarations (drop JSON-Schema meta keys Gemini rejects). */
export function toFunctionDeclarations(tools: McpToolDef[]): GeminiFunctionDeclaration[] {
  return tools.map((t) => {
    const { $schema, additionalProperties, ...parameters } = t.inputSchema as Record<string, unknown> & {
      $schema?: unknown;
      additionalProperties?: unknown;
    };
    void $schema;
    void additionalProperties;
    const decl: GeminiFunctionDeclaration = { name: t.name };
    if (t.description) decl.description = t.description;
    if (Object.keys(parameters).length > 0) decl.parameters = parameters;
    return decl;
  });
}

/** Human-readable tool name: tracking_checkup -> Tracking checkup. */
export function prettyToolName(name: string): string {
  const words = name.split("_").filter(Boolean);
  if (words.length === 0) return name;
  const [first, ...rest] = words as [string, ...string[]];
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

const MAX_TOOL_DISPLAY_CHARS = 2000;

/** Tool result → compact display object for the Tool chip (truncates huge payloads). */
export function toDisplayOutput(result: unknown): Record<string, unknown> {
  if (result !== null && typeof result === "object") {
    const s = JSON.stringify(result) ?? "";
    return s.length > MAX_TOOL_DISPLAY_CHARS
      ? { truncated: `${s.slice(0, MAX_TOOL_DISPLAY_CHARS)}… (${s.length} chars total)` }
      : (result as Record<string, unknown>);
  }
  const s = typeof result === "string" ? result : String(result ?? "");
  return s.length > MAX_TOOL_DISPLAY_CHARS
    ? { truncated: `${s.slice(0, MAX_TOOL_DISPLAY_CHARS)}… (${s.length} chars total)` }
    : { result: s };
}

export type StreamEvent =
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

/** Parse one SSE `data:` line. Returns null for keep-alives and garbage. */
export function parseSSEEvent(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  try {
    const evt = JSON.parse(trimmed.slice(5)) as Partial<StreamEvent> | null;
    if (!evt || typeof evt !== "object" || typeof evt.t !== "string") return null;
    return evt as StreamEvent;
  } catch {
    return null;
  }
}

export function parseChatBody(body: unknown): ChatMessage[] {  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) {
    throw new Error("messages array is required");
  }
  const messages = (body as { messages: unknown[] }).messages.map((m) => {
    if (!m || typeof m !== "object") throw new Error("invalid message");
    const { role, text } = m as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "model") || typeof text !== "string") throw new Error("invalid message");
    return { role: role as "user" | "model", text };
  });
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    throw new Error("last message must be from the user");
  }
  return messages;
}
