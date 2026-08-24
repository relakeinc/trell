import { createHash, randomBytes } from "node:crypto";

export function generateKey(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export function hashSk(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function newApiKeys(pkPrefix: string, skPrefix: string): { pk: string; sk: string; skHash: string } {
  const pk = generateKey(pkPrefix);
  const sk = generateKey(skPrefix);
  return { pk, sk, skHash: hashSk(sk) };
}
