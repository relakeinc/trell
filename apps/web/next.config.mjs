/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trell/shared"],
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
