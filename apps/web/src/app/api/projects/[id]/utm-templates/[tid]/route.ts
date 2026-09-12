import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";

async function canAccess(projectId: string, userId: string): Promise<boolean> {
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  return svc.canAccessProject(userId, projectId);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; tid: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, tid } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.source !== undefined) data.source = body.source?.trim() || null;
  if (body.medium !== undefined) data.medium = body.medium?.trim() || null;
  if (body.campaign !== undefined) data.campaign = body.campaign?.trim() || null;
  if (body.term !== undefined) data.term = body.term?.trim() || null;
  if (body.content !== undefined) data.content = body.content?.trim() || null;
  if (body.referral !== undefined) data.referral = body.referral?.trim() || null;

  const existing = await prisma.utmTemplate.findFirst({ where: { id: tid, projectId: id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const template = await prisma.utmTemplate.update({
    where: { id: tid },
    data,
  });

  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; tid: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, tid } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.utmTemplate.deleteMany({
    where: { id: tid, projectId: id },
  });

  return NextResponse.json({ ok: true });
}
