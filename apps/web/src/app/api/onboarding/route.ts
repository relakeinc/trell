import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { newApiKeys } from "@/lib/serverKeys";
import { encrypt } from "@/lib/crypto";
import { createHash, randomBytes } from "node:crypto";

/** Create the user's first project during onboarding and advance the step. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json()) as { name?: string; domains?: string | string[] };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "invalid_request", message: "name is required" }, { status: 400 });

  const encKey = process.env.TRELL_ENC_KEY;
  if (!encKey) return NextResponse.json({ error: "config", message: "TRELL_ENC_KEY is not set" }, { status: 500 });

  const domains = Array.isArray(body.domains) ? body.domains.join(",") : (body.domains ?? "");

  const { pk, sk, skHash } = newApiKeys("pk", "sk");
  const slug = slugify(name);

  // Generate a default API key
  const defaultPk = `pk_${randomBytes(16).toString("hex")}`;
  const defaultSk = `sk_${randomBytes(16).toString("hex")}`;
  const defaultKeyHash = createHash("sha256").update(defaultSk).digest("hex");
  const defaultKeyPrefix = defaultPk.slice(0, 12);

  const project = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    const p = await tx.project.create({
      data: {
        name,
        slug,
        publishableKey: pk,
        apiKeyHash: skHash,
        apiKeyEncrypted: encrypt(sk, encKey),
        domains,
        organizationId: org.id,
      },
    });
    await tx.projectUser.create({
      data: { projectId: p.id, userId, role: "owner" },
    });
    // Create default API key
    await tx.apiKey.create({
      data: {
        projectId: p.id,
        name: "Default",
        keyHash: defaultKeyHash,
        keyPrefix: defaultKeyPrefix,
      },
    });
    return p;
  });

  // Advance step: 1 -> 2 (project created, keys not yet confirmed seen)
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStep: Math.max(1, await getStep(userId)) },
  });

  return NextResponse.json({ project: { id: project.id, name, slug }, keys: { pk, sk } }, { status: 201 });
}

async function getStep(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingStep: true } });
  return u?.onboardingStep ?? 0;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
