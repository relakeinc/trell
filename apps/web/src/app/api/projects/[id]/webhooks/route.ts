import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { getProjectOwnerPlan } from "@/lib/usage";
import { randomBytes } from "node:crypto";
import { webhookUrlFormatError } from "@trell/shared";

async function canAccess(projectId: string, userId: string): Promise<boolean> {
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  return svc.canAccessProject(userId, projectId);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
  if (!(await canAccess(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { url?: string; events?: string[] };
  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  const formatError = webhookUrlFormatError(url);
  if (formatError) return NextResponse.json({ error: formatError }, { status: 400 });

  // Webhooks are a Pro feature — enforce server-side, not just in the UI.
  const { plan } = await getProjectOwnerPlan(id);
  if (plan !== "pro") {
    return NextResponse.json({ error: "pro_required", message: "Webhooks require the Pro plan" }, { status: 403 });
  }

  const events = body.events?.filter(Boolean) ?? [];
  const secret = randomBytes(32).toString("hex");

  const webhook = await prisma.webhook.create({
    data: { projectId: id, url, events, secret },
  });

  return NextResponse.json({ webhook }, { status: 201 });
}
