import { describe, it, expect } from "vitest";
import { buildSystemPrompt, parseChatBody, parseOpenAIChunk, parseSSEEvent, prettyToolName, toDisplayOutput, toFunctionDeclarations, toOpenAIMessages, toOpenAITools } from "../src/lib/chatAgent";
import { signIdentityJwt } from "../src/lib/chatIdentity";

describe("chatAgent helpers", () => {
  it("builds a scoped system prompt", () => {
    const p = buildSystemPrompt({ workspaceSlug: "store", userEmail: "a@b.c" });
    expect(p).toContain("store");
    expect(p).toContain("confirm:true");
  });

  it("trims history to non-empty OpenAI messages with system first", () => {
    const out = toOpenAIMessages("sys", [
      { role: "user", text: "  " },
      { role: "user", text: "hi" },
      { role: "model", text: "hello" },
    ]);
    expect(out).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("maps MCP tools to Gemini declarations without $schema", () => {
    const out = toFunctionDeclarations([
      { name: "list_projects", description: "List", inputSchema: { $schema: "x", type: "object", properties: {} } },
    ]);
    expect(out).toEqual([{ name: "list_projects", description: "List", parameters: { type: "object", properties: {} } }]);
  });

  it("parses and validates chat bodies", () => {
    expect(() => parseChatBody({})).toThrow();
    expect(() => parseChatBody({ messages: [] })).toThrow();
    expect(() => parseChatBody({ messages: [{ role: "model", text: "x" }] })).toThrow();
    const ok = parseChatBody({ slug: "s", messages: [{ role: "user", text: "hi" }] });
    expect(ok).toEqual([{ role: "user", text: "hi" }]);
  });

  it("humanizes tool names", () => {
    expect(prettyToolName("tracking_checkup")).toBe("Tracking checkup");
    expect(prettyToolName("list_projects")).toBe("List projects");
    expect(prettyToolName("get_forms")).toBe("Get forms");
  });

  it("parses SSE data lines including thought events", () => {
    expect(parseSSEEvent(`data: {"t":"thought","d":"planning…"}`)).toEqual({ t: "thought", d: "planning…" });
    expect(parseSSEEvent(`data: {"t":"text","d":"hi"}`)).toEqual({ t: "text", d: "hi" });
    expect(parseSSEEvent(`data: {"t":"done"}`)).toEqual({ t: "done" });
    expect(parseSSEEvent(`data: {"t":"status","d":"working"}`)).toEqual({ t: "status", d: "working" });
    expect(parseSSEEvent(`data: {"t":"tool","name":"list_projects","state":"input-available"}`)).toEqual({
      t: "tool",
      name: "list_projects",
      state: "input-available",
    });
    expect(parseSSEEvent(`data: {"t":"error","d":"boom"}`)).toEqual({ t: "error", d: "boom" });
  });

  it("rejects SSE keep-alives and garbage", () => {
    expect(parseSSEEvent(": ping")).toBeNull();
    expect(parseSSEEvent("")).toBeNull();
    expect(parseSSEEvent("event: message")).toBeNull();
    expect(parseSSEEvent("data: not-json")).toBeNull();
    expect(parseSSEEvent(`data: {"nope":true}`)).toBeNull();
    expect(parseSSEEvent(`data: [1,2]`)).toBeNull();
  });

  it("passes tool input/output through SSE events", () => {
    expect(
      parseSSEEvent(`data: {"t":"tool","name":"get_breakdown","state":"input-available","input":{"a":1}}`),
    ).toEqual({ t: "tool", name: "get_breakdown", state: "input-available", input: { a: 1 } });
    expect(
      parseSSEEvent(`data: {"t":"tool","name":"get_breakdown","state":"output-available","output":{"ok":true}}`),
    ).toEqual({ t: "tool", name: "get_breakdown", state: "output-available", output: { ok: true } });
  });

  it("maps declarations to OpenAI tools with default parameters", () => {
    expect(
      toOpenAITools([{ name: "list_projects", description: "List", parameters: { type: "object", properties: {} } }]),
    ).toEqual([
      {
        type: "function",
        function: { name: "list_projects", description: "List", parameters: { type: "object", properties: {} } },
      },
    ]);
    expect(toOpenAITools([{ name: "ping" }])).toEqual([
      { type: "function", function: { name: "ping", parameters: { type: "object", properties: {} } } },
    ]);
  });

  it("normalizes OpenAI streaming chunks", () => {
    expect(parseOpenAIChunk({ choices: [{ delta: { content: "hi" } }] })).toEqual({
      content: "hi",
      reasoning: "",
      toolDeltas: [],
    });
    expect(parseOpenAIChunk({ choices: [{ delta: { reasoning: "hmm" } }] })).toEqual({
      content: "",
      reasoning: "hmm",
      toolDeltas: [],
    });
    expect(parseOpenAIChunk({ choices: [{ delta: { reasoning_content: "alt" } }] })).toEqual({
      content: "",
      reasoning: "alt",
      toolDeltas: [],
    });
    expect(
      parseOpenAIChunk({
        choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "f", arguments: '{"a":' } }] } }],
      }),
    ).toEqual({
      content: "",
      reasoning: "",
      toolDeltas: [{ index: 0, id: "c1", name: "f", args: '{"a":' }],
    });
    expect(parseOpenAIChunk({ choices: [{ delta: {}, finish_reason: "stop" }] })).toEqual({
      content: "",
      reasoning: "",
      toolDeltas: [],
    });
    expect(parseOpenAIChunk({ usage: {} })).toBeNull();
    expect(parseOpenAIChunk({ error: { message: "bad" } })).toBeNull();
    expect(parseOpenAIChunk(null)).toBeNull();
    expect(parseOpenAIChunk("x")).toBeNull();
  });

  it("compacts tool results for display", () => {
    expect(toDisplayOutput({ ok: true })).toEqual({ ok: true });
    expect(toDisplayOutput("done")).toEqual({ result: "done" });
    const big = { data: "x".repeat(5000) };
    const out = toDisplayOutput(big);
    expect(Object.keys(out)).toEqual(["truncated"]);
    expect((out.truncated as string).length).toBeLessThan(2500);
  });
});

describe("chatIdentity", () => {
  it("mints a parseable HS256 JWT with type access", () => {
    const t = signIdentityJwt("A@B.C", "secret-123", 60);
    expect(t.split(".")).toHaveLength(3);
    const payload = JSON.parse(Buffer.from(t.split(".")[1]!, "base64url").toString("utf8")) as {
      type: string;
      email: string;
      exp: number;
    };
    expect(payload.type).toBe("access");
    expect(payload.email).toBe("a@b.c");
    expect(payload.exp * 1000).toBeGreaterThan(Date.now());
  });
});
