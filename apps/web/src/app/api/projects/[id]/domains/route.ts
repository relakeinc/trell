import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { sanitizeDomains } from "@/lib/domains";
import { getProjectOwnerPlan } from "@/lib/usage";

async function canAccess(projectId: string, userId: string): Promise<boolean> {
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  return svc.canAccessProject(userId, projectId);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { domain?: string };
  const domain = body.domain?.trim();
  if (!domain)
    return NextResponse.json({ error: "domain is required", message: "Domain is required" }, { status: 400 });

  let normalized: string;
  try {
    const cleaned = sanitizeDomains([domain]);
    const first = cleaned[0];
    if (!first) throw new Error("invalid domain");
    normalized = first;
  } catch {
    return NextResponse.json(
      { error: "invalid_domain", message: "Enter a valid hostname (e.g. example.com)" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({ where: { id }, select: { domains: true } });
  if (!project) return NextResponse.json({ error: "not found", message: "Workspace not found" }, { status: 404 });

  const existing = project.domains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (existing.includes(normalized!)) {
    return NextResponse.json(
      { error: "domain already exists", message: "That domain is already added" },
      { status: 409 },
    );
  }

  const { limits } = await getProjectOwnerPlan(id);
  if (existing.length >= limits.domains) {
    return NextResponse.json(
      { error: "limit_reached", message: `Domain limit reached. Upgrade to Pro for more.` },
      { status: 403 },
    );
  }

  const updated = [...existing, normalized!];
  await prisma.project.update({ where: { id }, data: { domains: updated.join(",") } });

  return NextResponse.json({ domains: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { domain?: string };
  const domain = body.domain?.trim();
  if (!domain)
    return NextResponse.json({ error: "domain is required", message: "Domain is required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id }, select: { domains: true } });
  if (!project) return NextResponse.json({ error: "not found", message: "Workspace not found" }, { status: 404 });

  const existing = project.domains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const updated = existing.filter((d) => d !== domain.toLowerCase());
  await prisma.project.update({ where: { id }, data: { domains: updated.join(",") } });

  return NextResponse.json({ domains: updated });
}
