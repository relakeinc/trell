import { describe, it, expect, vi, afterEach } from "vitest";
import { webhookUrlFormatError, isPrivateLiteralIp } from "@trell/shared";
import { checkWebhookTarget } from "../src/lib/ssrf";
import { deliverWebhooks } from "../src/lib/webhook-delivery";
import type { WebhookStore } from "../src/lib/webhook-delivery";

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mockLookup }));

afterEach(() => {
  vi.unstubAllGlobals();
  mockLookup.mockReset();
});

describe("webhookUrlFormatError", () => {
  it.each([
    "https://hooks.example.com/trell",
    "http://hooks.example.com:8443/trell",
    "https://93.184.216.34/hook", // public literal IPv4
  ])("accepts %s", (url) => {
    expect(webhookUrlFormatError(url)).toBeNull();
  });

  it.each([
    ["ftp://hooks.example.com/x", "url must use http or https"],
    ["file:///etc/passwd", "url must use http or https"],
    ["https://user:pass@hooks.example.com/", "url must not include credentials"],
    ["http://127.0.0.1/hook", "url must not point at a private or internal address"],
    ["http://10.0.0.5/hook", "url must not point at a private or internal address"],
    ["http://192.168.1.10:3000/hook", "url must not point at a private or internal address"],
    ["http://169.254.169.254/latest/meta-data/", "url must not point at a private or internal address"],
    ["http://[::1]/hook", "url must not point at a private or internal address"],
    ["http://[::ffff:127.0.0.1]/hook", "url must not point at a private or internal address"],
    ["not a url", "url is not a valid URL"],
  ])("rejects %s", (url, reason) => {
    expect(webhookUrlFormatError(url)).toBe(reason);
  });

  it("flags private literals directly", () => {
    expect(isPrivateLiteralIp("127.0.0.1")).toBe(true);
    expect(isPrivateLiteralIp("10.1.2.3")).toBe(true);
    expect(isPrivateLiteralIp("172.16.0.1")).toBe(true);
    expect(isPrivateLiteralIp("172.31.255.255")).toBe(true);
    expect(isPrivateLiteralIp("172.32.0.1")).toBe(false);
    expect(isPrivateLiteralIp("192.168.0.1")).toBe(true);
    expect(isPrivateLiteralIp("169.254.169.254")).toBe(true);
    expect(isPrivateLiteralIp("8.8.8.8")).toBe(false);
    expect(isPrivateLiteralIp("::1")).toBe(true);
    expect(isPrivateLiteralIp("example.com")).toBe(false);
  });
});

describe("checkWebhookTarget", () => {
  it("blocks literal private IPs without touching DNS", async () => {
    const r = await checkWebhookTarget("http://169.254.169.254/x");
    expect(r.verdict).toBe("blocked");
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("blocks hostnames resolving to private addresses", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const r = await checkWebhookTarget("https://internal.example.com/hook");
    expect(r.verdict).toBe("blocked");
  });

  it("allows hostnames resolving to public addresses", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const r = await checkWebhookTarget("https://hooks.example.com/trell");
    expect(r.verdict).toBe("ok");
  });

  it("treats DNS failure as transient (retryable)", async () => {
    mockLookup.mockRejectedValue(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
    const r = await checkWebhookTarget("https://nx.example.com/hook");
    expect(r.verdict).toBe("transient");
  });
});

describe("delivery SSRF gate", () => {
  it("never fetches a private target and marks it failed", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, text: async () => "ok" }));
    vi.stubGlobal("fetch", fetchFn);
    const updates: Record<string, unknown>[] = [];
    const client = {
      webhook: {
        findMany: async () => [{ id: "wh1", url: "http://127.0.0.1:9/hook", secret: "s", enabled: true }],
      },
      webhookDelivery: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "d1", ...data }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return data;
        },
        findMany: async () => [],
      },
    } as unknown as WebhookStore;

    await deliverWebhooks("proj", "form_submit", { a: 1 }, client);

    expect(fetchFn).not.toHaveBeenCalled();
    const last = updates[updates.length - 1]!;
    expect(last["status"]).toBe("failed");
    expect(String(last["response"])).toMatch(/^ssrf_blocked/);
  });
});
