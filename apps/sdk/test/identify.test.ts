import { describe, it, expect } from "vitest";
import { sha256Sync, hashIdentity } from "../src/rng";

describe("sha256Sync", () => {
  it("matches the SHA-256 vector for 'abc'", () => {
    expect(sha256Sync("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic", () => {
    expect(sha256Sync("hello")).toBe(sha256Sync("hello"));
  });
});

describe("hashIdentity", () => {
  it("hashes userId and email, and never returns the raw values", () => {
    const props = hashIdentity({ userId: "user-123", email: "a@b.com" });
    expect(props.identify_user).toBe(sha256Sync("user-123"));
    expect(props.identify_email).toBe(sha256Sync("a@b.com"));
    const json = JSON.stringify(props);
    expect(json).toMatch(/^"$|[0-9a-f]{64}/);
    expect(json).not.toContain("user-123");
    expect(json).not.toContain("a@b.com");
  });

  it("returns an empty map when nothing is provided", () => {
    expect(hashIdentity({})).toEqual({});
  });
});
