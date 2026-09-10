import { createHmac } from "node:crypto";

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/**
 * Short-lived identity JWT for the MCP (same shape/secret as apps/mcp).
 * Lets the dashboard chat act AS the logged-in user without any OAuth flow.
 */
export function signIdentityJwt(email: string, secret: string, expiresInSec = 900): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlJson({ type: "access", email: email.toLowerCase(), iat: now, exp: now + expiresInSec });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
