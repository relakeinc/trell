import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const events = await prisma.event.findMany({
    where: {
      projectId,
      type: { in: ["form_submit", "form_success", "form_start", "form_view"] },
    },
    select: {
      id: true,
      type: true,
      ts: true,
      formId: true,
      formName: true,
      url: true,
      pagePath: true,
      visitorId: true,
      properties: true,
      deviceType: true,
      browser: true,
      os: true,
    },
    orderBy: { ts: "desc" },
    take: 500,
  });

  const submissions = events.map((e) => ({
    id: e.id,
    type: e.type,
    ts: e.ts.toISOString(),
    formId: e.formId,
    formName: e.formName,
    page: e.pagePath,
    url: e.url,
    visitorId: e.visitorId,
    fields: e.properties ? tryParseJson(e.properties) : null,
    device: e.deviceType,
    browser: e.browser,
    os: e.os,
  }));

  return NextResponse.json({ submissions });
}

function tryParseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
