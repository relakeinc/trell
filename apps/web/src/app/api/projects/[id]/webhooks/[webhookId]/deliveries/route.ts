import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";

export async function GET(
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

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId, webhook: { projectId: id } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      event: true,
      status: true,
      statusCode: true,
      response: true,
      attempts: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ deliveries });
}
