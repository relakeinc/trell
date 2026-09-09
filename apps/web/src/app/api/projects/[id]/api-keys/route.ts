import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { createHash, randomBytes } from "node:crypto";

async function canAccess(projectId: string, userId: string): Promise<boolean> {
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  return svc.canAccessProject(userId, projectId);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const keys = await prisma.apiKey.findMany({
    where: { projectId: id },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required", message: "Give the key a name" }, { status: 400 });
  if (name.length > 64) return NextResponse.json({ error: "name too long", message: "Name must be 64 characters or less" }, { status: 400 });

  // Server key: secret-only credential for backend use (.env).
  // The pk (browser snippet) is per-project and shown in Tracking.
  const sk = `sk_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(sk).digest("hex");
  const keyPrefix = sk.slice(0, 11);

  const apiKey = await prisma.apiKey.create({
    data: {
      projectId: id,
      name,
      keyHash,
      keyPrefix,
    },
  });

  // The secret is shown once — the browser never stores it
  return NextResponse.json({
    key: { id: apiKey.id, name: apiKey.name, keyPrefix, createdAt: apiKey.createdAt },
    secret: sk, // shown once, never stored in plaintext
  }, { status: 201 });
}
