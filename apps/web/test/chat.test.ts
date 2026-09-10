import { describe, it, expect } from "vitest";
import { buildSystemPrompt, parseChatBody, toFunctionDeclarations, toGeminiContents } from "../src/lib/chatAgent";
import { signIdentityJwt } from "../src/lib/chatIdentity";

describe("chatAgent helpers", () => {
  it("builds a scoped system prompt", () => {
    const p = buildSystemPrompt({ workspaceSlug: "store", userEmail: "a@b.c" });
    expect(p).toContain("store");
    expect(p).toContain("confirm:true");
  });

  it("trims history to non-empty messages", () => {
    const out = toGeminiContents([
      { role: "user", text: "  " },
      { role: "user", text: "hi" },
      { role: "model", text: "hello" },
    ]);
    expect(out).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "hello" }] },
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
