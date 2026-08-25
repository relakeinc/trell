import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tid } = await params;
  const body = (await req.json()) as {
    name?: string;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
    referral?: string | null;
  };

  const data: Record<string, string | null> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.source !== undefined) data.source = body.source?.trim() || null;
  if (body.medium !== undefined) data.medium = body.medium?.trim() || null;
  if (body.campaign !== undefined) data.campaign = body.campaign?.trim() || null;
  if (body.term !== undefined) data.term = body.term?.trim() || null;
  if (body.content !== undefined) data.content = body.content?.trim() || null;
  if (body.referral !== undefined) data.referral = body.referral?.trim() || null;

  const template = await prisma.utmTemplate.update({
    where: { id: tid },
    data,
  });

  return NextResponse.json({ template });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tid } = await params;

  await prisma.utmTemplate.deleteMany({
    where: { id: tid },
  });

  return NextResponse.json({ ok: true });
}
