import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateKey(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export function hashSk(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Constant-time string comparison for secrets (API keys, admin tokens).
 * Returns false on length mismatch instead of throwing.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function newApiKeys(pkPrefix: string, skPrefix: string): { pk: string; sk: string; skHash: string } {
  const pk = generateKey(pkPrefix);
  const sk = generateKey(skPrefix);
  return { pk, sk, skHash: hashSk(sk) };
}
