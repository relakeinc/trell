/**
 * Pure (browser-safe, no node imports) URL validation for webhook targets.
 * Format-level only: hostnames that are not literal IPs must additionally
 * pass a DNS check server-side (see apps/api/src/lib/ssrf.ts), because a
 * public-looking hostname can resolve to a private address.
 */

/** Split a hostname into parts; null when not a valid IPv4 literal. */
function ipv4Parts(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((p) => p > 255)) return null;
  return parts as [number, number, number, number];
}

/** Expand an IPv6 literal into 8 hextets; null when invalid. */
function ipv6Hextets(host: string): number[] | null {
  const halves = host.split("::");
  if (halves.length > 2) return null;
  const parseSide = (side: string): (number | string)[] | null => {
    if (side === "") return [];
    return side.split(":").map((seg) => {
      if (seg.includes(".")) return seg; // embedded IPv4, handled below
      if (!/^[0-9a-fA-F]{1,4}$/.test(seg)) return null as unknown as string;
      return parseInt(seg, 16);
    }) as (number | string)[];
  };
  const head = parseSide(halves[0] ?? "");
  const tail = parseSide(halves.length === 2 ? (halves[1] ?? "") : "");
  if (!head || !tail) return null;
  const segs: (number | string)[] = [...head, ...tail];
  // Expand embedded IPv4 (e.g. ::ffff:1.2.3.4) into two hextets.
  for (let i = 0; i < segs.length; i++) {
    if (typeof segs[i] === "string") {
      const v4 = ipv4Parts(segs[i] as string);
      if (!v4) return null;
      segs.splice(i, 1, (v4[0] * 256 + v4[1]) as number, (v4[2] * 256 + v4[3]) as number);
    }
  }
  if (halves.length === 1) return segs.length === 8 ? (segs as number[]) : null;
  if (segs.length > 7) return null;
  const missing = 8 - segs.length;
  return [...(head as number[]), ...new Array(missing).fill(0), ...(tail as number[])];
}

function isPrivateIpv4(p: [number, number, number, number]): boolean {
  const [a, b, c] = p;
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local (cloud metadata!)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay (deprecated)
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIpv6(h: number[]): boolean {
  const isZero = (i: number) => h[i] === 0;
  if (h.every((x) => x === 0)) return true; // ::
  if (h.slice(0, 7).every(isZero) && h[7] === 1) return true; // ::1 loopback
  if (h[0] !== undefined && h[0] >= 0xfe80 && h[0] <= 0xfebf) return true; // link-local
  if (h[0] !== undefined && (h[0] & 0xfe00) === 0xfc00) return true; // unique-local
  if (h[0] !== undefined && (h[0] & 0xff00) === 0xff00) return true; // multicast
  // ::ffff:0:0/96 IPv4-mapped — unwrap and check the IPv4 part.
  if (h.slice(0, 5).every(isZero) && h[5] === 0xffff) {
    return isPrivateIpv4([h[6]! >> 8, h[6]! & 0xff, h[7]! >> 8, h[7]! & 0xff]);
  }
  return false;
}

/** True when the host is a literal IP address pointing at non-public space. */
export function isPrivateLiteralIp(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  const v4 = ipv4Parts(h);
  if (v4) return isPrivateIpv4(v4);
  if (h.includes(":")) {
    const hextets = ipv6Hextets(h);
    if (hextets) return isPrivateIpv6(hextets);
  }
  return false;
}

/**
 * Format-level validation for a webhook target URL.
 * Returns null when the format is acceptable, otherwise a human-readable reason.
 * NOTE: a hostname passing this check can still resolve to a private IP —
 * always run the async DNS check (assertPublicWebhookUrl) before fetching.
 */
export function webhookUrlFormatError(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "url is not a valid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "url must use http or https";
  }
  if (!url.hostname) return "url must include a hostname";
  if (url.username || url.password) return "url must not include credentials";
  if (isPrivateLiteralIp(url.hostname)) {
    return "url must not point at a private or internal address";
  }
  return null;
}
