import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";
import { newApiKeys, hashSk } from "@/lib/serverKeys";

describe("server-side secret handling", () => {
  it("encrypts/decrypts a secret round-trip", () => {
    const enc = encrypt("sk_abc123", "my-key");
    expect(decrypt(enc, "my-key")).toBe("sk_abc123");
  });

  it("fails to decrypt with the wrong key", () => {
    const enc = encrypt("sk_abc123", "right-key");
    expect(() => decrypt(enc, "wrong-key")).toThrow();
  });

  it("hashSk produces a sha256 and never equals the plain secret", () => {
    const sk = "sk_secret_xyz";
    const h = hashSk(sk);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(sk);
  });

  it("newApiKeys emits pk_/sk_ prefixed keys and a matching hash", () => {
    const { pk, sk, skHash } = newApiKeys("pk", "sk");
    expect(pk.startsWith("pk_")).toBe(true);
    expect(sk.startsWith("sk_")).toBe(true);
    expect(skHash).toBe(hashSk(sk));
  });
});
