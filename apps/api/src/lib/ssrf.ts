import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { webhookUrlFormatError, isPrivateLiteralIp } from "@trell/shared";

export type TargetVerdict = "ok" | "blocked" | "transient";

const DNS_TIMEOUT_MS = 5_000;

/**
 * Server-side SSRF gate for webhook targets. Format-level checks come from
 * @trell/shared (browser-safe); here we additionally resolve the hostname and
 * require EVERY resolved address to be public. DNS failure is "transient"
 * (retryable), a private address is "blocked" (permanent).
 */
export async function checkWebhookTarget(raw: string): Promise<{ verdict: TargetVerdict; reason?: string }> {
  const formatError = webhookUrlFormatError(raw);
  if (formatError) return { verdict: "blocked", reason: formatError };

  const host = new URL(raw.trim()).hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (isPrivateLiteralIp(host)) {
    return { verdict: "blocked", reason: "url points at a private or internal address" };
  }

  let addresses: string[];
  try {
    const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("dns timeout")), DNS_TIMEOUT_MS));
    const records = await Promise.race([lookup(host, { all: true, verbatim: true }), timer]);
    addresses = records.map((r) => r.address);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { verdict: "transient", reason: `DNS lookup failed for ${host}: ${msg}` };
  }

  if (addresses.length === 0) {
    return { verdict: "transient", reason: `DNS lookup returned no addresses for ${host}` };
  }
  for (const ip of addresses) {
    const clean = ip.toLowerCase().replace(/^\[(.*)\]$/, "$1");
    if (isIP(clean) === 0 || isPrivateLiteralIp(clean)) {
      return { verdict: "blocked", reason: `url resolves to a private or internal address` };
    }
  }
  return { verdict: "ok" };
}
