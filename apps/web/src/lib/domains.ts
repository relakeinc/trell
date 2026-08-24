/** Domain allowlist validation. Accepts `example.com`, `sub.example.com`, `*.example.com`, `localhost`. */
const DOMAIN_RE =
  /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

export function normalizeDomain(d: string): string {
  return d.trim().toLowerCase().replace(/\/$/, "");
}

export function isValidDomain(d: string): boolean {
  const norm = normalizeDomain(d);
  if (norm === "localhost" || norm === "*.localhost") return true;
  return DOMAIN_RE.test(norm);
}

/**
 * Validates and deduplicates a list of domains. Throws on invalid entries or
 * returns a normalized, de-duplicated array.
 */
export function sanitizeDomains(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const d = normalizeDomain(raw);
    if (!d) continue;
    if (!isValidDomain(d)) throw new Error(`invalid domain: ${raw}`);
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

/** Split the stored comma-separated allowlist into an array. */
export function parseDomains(stored: string): string[] {
  return stored.split(",").map((d) => d.trim()).filter(Boolean);
}
