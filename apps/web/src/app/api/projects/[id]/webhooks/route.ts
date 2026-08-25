import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "node:crypto";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const webhooks = await prisma.webhook.findMany({
    where: { projectId: id },
    select: { id: true, url: true, events: true, secret: true, enabled: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ webhooks });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { url?: string; events?: string[] };
  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const events = body.events?.filter(Boolean) ?? [];
  const secret = randomBytes(32).toString("hex");

  const webhook = await prisma.webhook.create({
    data: { projectId: id, url, events, secret },
  });

  return NextResponse.json({ webhook }, { status: 201 });
}
