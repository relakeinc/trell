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

export function buildSystemPrompt(opts: { workspaceSlug: string; userEmail: string }): string {
  return [
    `You are Ask Trell, the in-dashboard assistant for the Trell workspace "${opts.workspaceSlug}".`,
    `You talk to ${opts.userEmail}. Reply in the user's language (default Spanish if unclear). Be concise.`,
    "You have read-only AND write tools (funnels, UTM, domains, webhooks, API keys).",
    "Rules:",
    "- Never invent numbers: always call a tool first when asked about data.",
    "- Prefer the current workspace unless the user names another one they belong to.",
    "- For destructive actions (revoke key, delete workspace, rotate secret) explain the consequence and ask for explicit confirmation BEFORE calling — the tool itself also requires confirm:true.",
    "- Secrets are shown once by the tools; tell the user to save them in .env immediately.",
    "- If a tool errors, explain it plainly and suggest the fix.",
  ].join("\n");
}

/** Trim history for the model: last N non-empty messages. */
export function toGeminiContents(messages: ChatMessage[]): { role: "user" | "model"; parts: { text: string }[] }[] {
  return messages
    .filter((m) => m.text.trim().length > 0)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
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

export function parseChatBody(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) {
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
