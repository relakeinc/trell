import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { apiRelay } from "@/lib/apiClient";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; vid: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, vid } = await ctx.params;
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  if (!(await svc.canAccessProject(session.user.id, id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await apiRelay({ projectId: id, path: `views/${vid}`, method: "DELETE" }));
  } catch (e) {
    return NextResponse.json({ error: "relay_error", message: e instanceof Error ? e.message : "relay_error" }, { status: 502 });
  }
}
