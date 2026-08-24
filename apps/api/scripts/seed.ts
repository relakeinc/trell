import { PrismaClient } from "@prisma/client";
import { PrismaRepo } from "../src/repositories/prisma";
import { newApiKeys } from "../src/lib/crypto";

/**
 * Creates a demo project seeded with known publishable/secret keys.
 * Run: pnpm db:seed   (requires DATABASE_URL and TRELL_ADMIN_KEY optional)
 * The secret key is printed once; only its hash is stored.
 */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required to seed.");
  process.exit(1);
}

const name = process.env.TRELL_SEED_PROJECT ?? "Demo Site";
const domains = process.env.TRELL_SEED_DOMAINS ?? "example.com,*.example.com";

const prisma = new PrismaClient();
const repo = new PrismaRepo(prisma);

const { pk, sk, skHash } = newApiKeys(
  process.env.TRELL_PK_PREFIX ?? "pk",
  process.env.TRELL_SK_PREFIX ?? "sk",
);

const project = await repo.createOrganizationAndProject({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  organizationName: name,
  pk,
  skHash,
  domains,
});

console.log("Project seeded.");
console.log(`  id:   ${project.id}`);
console.log(`  name: ${project.name}`);
console.log(`  slug: ${project.slug}`);
console.log(`  pk:   ${pk}`);
console.log(`  sk:   ${sk}   <-- shown ONCE; only the hash is stored`);
console.log(`  domain allowlist: ${domains}`);

await prisma.$disconnect();
