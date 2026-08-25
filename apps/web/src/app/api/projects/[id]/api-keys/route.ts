import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
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
  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // Generate a new pk/sk pair
  const pk = `pk_${randomBytes(16).toString("hex")}`;
  const sk = `sk_${randomBytes(16).toString("hex")}`;
  const keyHash = createHash("sha256").update(sk).digest("hex");
  const keyPrefix = pk.slice(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: {
      projectId: id,
      name,
      keyHash,
      keyPrefix,
    },
  });

  // The full key is shown once — the browser never stores it
  return NextResponse.json({
    key: { id: apiKey.id, name: apiKey.name, publicKey: pk, createdAt: apiKey.createdAt },
    secret: sk, // shown once, never stored in plaintext
  }, { status: 201 });
}
