import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, webhookId } = await params;
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  if (!(await svc.canAccessProject(session.user.id, id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.webhook.deleteMany({
    where: { id: webhookId, projectId: id },
  });

  return NextResponse.json({ ok: true });
}
