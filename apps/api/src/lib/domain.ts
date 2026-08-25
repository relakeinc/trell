/** Match a request host against an allowlist pattern. Supports `example.com` and `*.example.com`. */
export function matchesDomain(host: string, pattern: string): boolean {
  // Strip protocol and path from the pattern (user may store "https://example.com/path")
  let p = pattern.trim().toLowerCase();
  try { p = new URL(p.includes("://") ? p : "https://" + p).host; } catch (_) { p = pattern.trim().toLowerCase(); }
  const h = host.trim().toLowerCase();
  if (p === "*") return true;
  if (p.startsWith("*.")) {
    const suffix = p.slice(2);
    return h.endsWith("." + suffix);
  }
  return h === p;
}

/** Match against a comma-separated list of patterns. Empty list allows all. */
export function isOriginAllowed(host: string, domains: string): boolean {
  const list = domains.split(",").map((d) => d.trim()).filter(Boolean);
  if (list.length === 0) return true;
  return list.some((pattern) => matchesDomain(host, pattern)) || matchesDomain(host, "*." + host);
}
