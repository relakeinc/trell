import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { getProjectDetail } from "@/lib/projectDetail";

/**
 * Resolve a project by workspace slug in a SINGLE round trip.
 * Used by the settings ProjectProvider instead of list-then-detail.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const projects = await svc.listAccessibleProjects(session.user.id);
  const match = projects.find((p) => p.slug === slug);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const detail = await getProjectDetail(match.id, session.user.id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}
