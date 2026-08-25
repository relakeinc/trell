import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { newApiKeys, hashSk } from "@/lib/serverKeys";
import { encrypt } from "@/lib/crypto";
import { getPlanLimits } from "@/lib/plans";
import { createHash, randomBytes } from "node:crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const projects = await svc.listAccessibleProjects(session.user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json()) as { name?: string; domains?: string | string[] };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "invalid_request", message: "name is required" }, { status: 400 });

  const encKey = process.env.TRELL_ENC_KEY;
  if (!encKey) return NextResponse.json({ error: "config", message: "TRELL_ENC_KEY is not set" }, { status: 500 });

  // Check project limit
  const limits = getPlanLimits("free");
  const projectCount = await prisma.project.count({
    where: { members: { some: { userId } } },
  });
  if (projectCount >= limits.projects) {
    return NextResponse.json({ error: "limit_reached", message: `Free plan allows up to ${limits.projects} projects. Upgrade to Pro for more.` }, { status: 403 });
  }

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

  // the secret key is shown exactly once — the browser never stores it
  return NextResponse.json({ project: { id: project.id, name, slug }, keys: { pk, sk } }, { status: 201 });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
