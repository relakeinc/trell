/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  transpilePackages: ["@trell/shared"],
  // Docs on relake.co link here directly; the app serves them under /legal.
  async redirects() {
    return [
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/security", destination: "/legal", permanent: true },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Dev tunnels (VS Code, GitHub Codespaces) and LAN access: the dev server
  // rejects cross-origin `_next` requests without this.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.37.1",
    "**.devtunnels.ms",
    "*.devtunnels.ms",
    "**.github.dev",
    "*.app.github.dev",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "react-markdown", "remark-gfm", "remark-breaks"],
    // Server Actions abort when `origin` differs from `x-forwarded-host`
    // (Next's CSRF check). Tunnels rewrite the forwarded host, so allow the
    // origins we actually browse from. Entries are matched against
    // `new URL(origin).host`, i.e. they include the port.
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "192.168.37.1:3000",
        "**.devtunnels.ms",
        "*.devtunnels.ms",
        "**.github.dev",
        "*.app.github.dev",
      ],
    },
  },
};

export default nextConfig;
