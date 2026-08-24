import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt a secret (e.g. sk) for storage at rest. */
export function encrypt(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyFrom(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/** Decrypt a secret stored with `encrypt`. */
export function decrypt(payload: string, secret: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv(ALGO, keyFrom(secret), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}
