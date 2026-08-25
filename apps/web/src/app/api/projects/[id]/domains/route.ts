import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { domain?: string };
  const domain = body.domain?.trim();
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id }, select: { domains: true } });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = project.domains.split(",").map((d) => d.trim()).filter(Boolean);
  if (existing.includes(domain)) {
    return NextResponse.json({ error: "domain already exists" }, { status: 409 });
  }

  const updated = [...existing, domain];
  await prisma.project.update({ where: { id }, data: { domains: updated.join(",") } });

  return NextResponse.json({ domains: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { domain?: string };
  const domain = body.domain?.trim();
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id }, select: { domains: true } });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = project.domains.split(",").map((d) => d.trim()).filter(Boolean);
  const updated = existing.filter((d) => d !== domain);
  await prisma.project.update({ where: { id }, data: { domains: updated.join(",") } });

  return NextResponse.json({ domains: updated });
}
