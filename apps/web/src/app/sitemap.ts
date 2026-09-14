import type { MetadataRoute } from "next";

const BASE = "https://trell.relake.co";

// Public pages only: the dashboard ([slug]/*) requires auth and crawlers
// just get redirected to /signin, so there is nothing to index there.
const PUBLIC_PATHS = ["/signin", "/register", "/pricing", "/legal", "/legal/terms", "/legal/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "/pricing" ? 0.8 : 0.5,
  }));
}
