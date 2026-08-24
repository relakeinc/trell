import { PrismaClient } from "@prisma/client";
import { PrismaRepo } from "../src/repositories/prisma";
import { MemoryRepo } from "../src/repositories/memory";
import { seedSyntheticEvents } from "../src/dev/synthetic";

/**
 * CLI to seed synthetic validation data.
 *   pnpm db:seed:events                  (MemoryRepo — prints credentials)
 *   DATABASE_URL=... pnpm db:seed:events (writes to Postgres/Prisma)
 */
const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;
const repo = prisma ? new PrismaRepo(prisma) : new MemoryRepo();
const seed = await seedSyntheticEvents(repo);

console.log("Synthetic events seeded.");
console.log(`  project id: ${seed.projectId}`);
console.log(`  sk:         ${seed.sk}`);
console.log(`  pk:         ${seed.pk}`);
console.log(`  inserted:   ${seed.inserted}`);
console.log(`  duplicates: ${seed.duplicates}`);

await prisma?.$disconnect();
