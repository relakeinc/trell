import { describe, it, expect } from "vitest";
import { isValidDomain, normalizeDomain, sanitizeDomains, parseDomains } from "@/lib/domains";

describe("domain allowlist validation", () => {
  it("accepts valid hostnames", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("sub.example.com")).toBe(true);
    expect(isValidDomain("*.example.com")).toBe(true);
    expect(isValidDomain("localhost")).toBe(true);
  });

  it("rejects invalid domains", () => {
    expect(isValidDomain("not a domain")).toBe(false);
    expect(isValidDomain("http://example.com")).toBe(false);
    expect(isValidDomain("https://example.com/path")).toBe(false);
    expect(isValidDomain("example")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });

  it("normalizes case and trailing slashes", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
    expect(normalizeDomain("EXAMPLE.com/")).toBe("example.com");
  });

  it("sanitizes and deduplicates", () => {
    expect(() => sanitizeDomains(["Example.com", "example.com", "*.example.com", "bad domain"])).toThrow();
    expect(sanitizeDomains(["Example.com", "example.com", "*.example.com"])).toEqual(["example.com", "*.example.com"]);
    expect(() => sanitizeDomains(["bad domain"])).toThrow();
  });

  it("parses a stored comma list", () => {
    expect(parseDomains("a.com, *.b.com ,c.com")).toEqual(["a.com", "*.b.com", "c.com"]);
  });
});
