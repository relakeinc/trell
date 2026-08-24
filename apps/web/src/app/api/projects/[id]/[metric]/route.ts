import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { analytics } from "@/lib/apiClient";

const METRICS = ["stats", "series", "breakdown", "forms", "events", "funnel-live"] as const;
type Metric = (typeof METRICS)[number];

const FORWARD_PARAMS = [
  "from", "to", "interval", "dimension", "limit", "form", "type",
  "page", "device", "browser", "os", "utmSource", "utmMedium", "utmCampaign",
  "compareFrom", "compareTo", "funnelId", "cursor", "segment",
] as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; metric: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, metric } = await ctx.params;
  if (!METRICS.includes(metric as Metric)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const allowed = await svc.canAccessProject(session.user.id, id);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const reqUrl = new URL(req.url);
  const search: Record<string, string | undefined> = {};
  for (const k of FORWARD_PARAMS) {
    const v = reqUrl.searchParams.get(k) ?? undefined;
    if (v !== undefined) search[k] = v;
  }

  try {
    const data = await analytics<unknown>({ projectId: id, metric, search });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "relay_error";
    return NextResponse.json({ error: "relay_error", message: msg }, { status: 502 });
  }
}
