import "dotenv/config";
import { createServer } from "node:http";
import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { createMcpHttpListener, mcpConfigFromEnv } from "@trell/mcp";
import { createApp } from "./app";
import { configFromEnv } from "./config";
import { MemoryRepo } from "./repositories/memory";
import { PrismaRepo } from "./repositories/prisma";
import { RateLimiter } from "./middleware/ratelimit";
import { seedSyntheticEvents } from "./dev/synthetic";
import { retryStuckDeliveries } from "./lib/webhook-delivery";

const config = configFromEnv();
const port = Number(process.env.PORT ?? 8787);

let repo: PrismaRepo | MemoryRepo;
let prisma: PrismaClient | null = null;
if (process.env.DATABASE_URL) {
  prisma = new PrismaClient();
  repo = new PrismaRepo(prisma);
  console.log("[trell:api] using Postgres (Prisma)");
} else {
  repo = new MemoryRepo();
  console.warn("[trell:api] DATABASE_URL not set — using in-memory repo (ephemeral).");
}

const app = createApp({
  repo,
  config,
  limiter: new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs),
  ...(prisma ? { prisma } : {}),
});

function startMcp(): void {
  // MCP over Streamable HTTP (same process/DB, localhost only); fail-closed without MCP_API_KEY.
  const mcpConfig = mcpConfigFromEnv();
  if (mcpConfig.apiKey) {
    const mcpPort = Number(process.env.MCP_HTTP_PORT ?? 8788);
    const listener = createMcpHttpListener({ store: repo, config: mcpConfig });
    // 0.0.0.0 in container: docker-proxy reaches us via container IP; port mapping restricts host access.
    createServer((req, res) => void listener(req, res)).listen(mcpPort, "0.0.0.0", () => {
      console.log(`[trell:api] mcp http on :${mcpPort}`);
    });
  } else {
    console.warn("[trell:api] MCP_API_KEY not set — mcp http endpoint disabled");
  }
}

// MCP_ONLY=1 (dedicated mcp container): skip Hono, serve MCP alone.
if (process.env.MCP_ONLY === "1") {
  console.log("[trell:api] MCP_ONLY=1 — hono disabled");
  startMcp();
} else {
  serve({ fetch: app.fetch, port }, async (info) => {
    console.log(`[trell:api] listening on http://localhost:${info.port}`);
    if (prisma) {
      // Sweep "pending" deliveries stuck by a crash mid-retry (memory repo has none).
      const sweepStore = prisma;
      const sweep = setInterval(() => {
        retryStuckDeliveries(sweepStore).catch((e) => console.error("[trell:api] webhook retry sweep failed", e));
      }, 60_000);
      (sweep as unknown as { unref?: () => void }).unref?.();
    }
    if (process.env.TRELL_DEV_SEED === "1") {
      const seed = await seedSyntheticEvents(repo);
      console.log("[trell:api] seeded synthetic data (dev). Project id + keys to paste in the dashboard:");
      console.log(`  project id: ${seed.projectId}`);
      console.log(`  sk:         ${seed.sk}`);
      console.log(`  pk:         ${seed.pk}`);
    }
    if (!config.adminKey) {
      console.warn("[trell:api] set TRELL_ADMIN_KEY to create projects via POST /v1/projects");
    }
    startMcp();
  });
}
