import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaClient } from "@prisma/client";
import { createMcpServer, mcpConfigFromEnv } from "@trell/mcp";
import { MemoryRepo, PrismaRepo } from "./repositories/index.js";

// Repo root works from src/ (tsx) and dist/ (node): apps/api/{src,dist} → root.
const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

for (const file of ["apps/api/.env", ".env"]) {
  const path = join(REPO_ROOT, file);
  if (existsSync(path)) loadDotenv({ path });
  if (process.env.DATABASE_URL) break;
}

async function main(): Promise<void> {
  const config = mcpConfigFromEnv();

  let repo;
  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient();
    repo = new PrismaRepo(prisma);
    console.error("[trell:mcp] using Postgres");
  } else if (process.env.MCP_DEMO === "1") {
    repo = new MemoryRepo();
    console.error("[trell:mcp] demo mode (in-memory, ephemeral)");
  } else {
    console.error("[trell:mcp] set DATABASE_URL (Postgres) or MCP_DEMO=1 (demo data)");
    process.exit(1);
  }

  const server = createMcpServer({ store: repo, config });
  await server.connect(new StdioServerTransport());
  console.error("[trell:mcp] stdio ready");
}

main().catch((e) => {
  console.error("[trell:mcp] fatal", e instanceof Error ? e.message : e);
  process.exit(1);
});
