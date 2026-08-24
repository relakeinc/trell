import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { configFromEnv } from "./config";
import { MemoryRepo } from "./repositories/memory";
import { PrismaRepo } from "./repositories/prisma";
import { RateLimiter } from "./middleware/ratelimit";
import { seedSyntheticEvents } from "./dev/synthetic";

const config = configFromEnv();
const port = Number(process.env.PORT ?? 8787);

let repo;
if (process.env.DATABASE_URL) {
  const prisma = new PrismaClient();
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
});

serve({ fetch: app.fetch, port }, async (info) => {
  console.log(`[trell:api] listening on http://localhost:${info.port}`);
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
});
