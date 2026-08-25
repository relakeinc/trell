import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const templates = await prisma.utmTemplate.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
    referral?: string;
  };

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const template = await prisma.utmTemplate.create({
    data: {
      projectId: id,
      name,
      source: body.source?.trim() || null,
      medium: body.medium?.trim() || null,
      campaign: body.campaign?.trim() || null,
      term: body.term?.trim() || null,
      content: body.content?.trim() || null,
      referral: body.referral?.trim() || null,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
