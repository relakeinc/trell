import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { parseDomains, sanitizeDomains, normalizeDomain } from "@/lib/domains";
import { getProjectOwnerPlan } from "@/lib/usage";

async function authorize(projectId: string, userId: string): Promise<boolean> {
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  return svc.canAccessProject(userId, projectId);
}

/** Project detail + installation status. NEVER returns the secret key. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  if (!(await authorize(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, publishableKey: true, domains: true, logoVariant: true, createdAt: true },
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { plan, limits, billingPeriodStart } = await getProjectOwnerPlan(id);
  const lastEvent = await prisma.event.aggregate({ where: { projectId: id }, _max: { ts: true } });
  const totalEvents = await prisma.event.count({ where: { projectId: id } });

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      plan,
      pk: project.publishableKey,
      domains: parseDomains(project.domains),
      logoVariant: project.logoVariant,
      createdAt: project.createdAt,
    },
    installation: {
      connected: lastEvent._max.ts != null,
      lastEventAt: lastEvent._max.ts ? lastEvent._max.ts.toISOString() : null,
    },
    usage: {
      events: totalEvents,
      limit: limits.events,
      domains: parseDomains(project.domains).length,
      domainLimit: limits.domains,
      billingPeriodStart: billingPeriodStart.toISOString(),
    },
  });
}

/** Edit the allowed domain allowlist (add/remove). Reflected immediately by ingestion. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  if (!(await authorize(id, session.user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { name?: string; slug?: string; addDomain?: string; removeDomain?: string; logoVariant?: number };
  const project = await prisma.project.findUnique({ where: { id }, select: { domains: true, slug: true } });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { limits } = await getProjectOwnerPlan(id);
  const updateData: Record<string, unknown> = {};

  // Update name
  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "invalid_name", message: "Name cannot be empty" }, { status: 400 });
    if (trimmed.length > 32) return NextResponse.json({ error: "invalid_name", message: "Name must be 32 characters or less" }, { status: 400 });
    updateData.name = trimmed;
  }

  // Update slug
  if (body.slug !== undefined) {
    const trimmed = body.slug.trim().toLowerCase();
    if (!trimmed) return NextResponse.json({ error: "invalid_slug", message: "Slug cannot be empty" }, { status: 400 });
    if (!/^[a-z0-9-]+$/.test(trimmed)) return NextResponse.json({ error: "invalid_slug", message: "Only lowercase letters, numbers, and dashes" }, { status: 400 });
    if (trimmed.length > 48) return NextResponse.json({ error: "invalid_slug", message: "Slug must be 48 characters or less" }, { status: 400 });
    if (trimmed !== project.slug) {
      const exists = await prisma.project.findUnique({ where: { slug: trimmed } });
      if (exists) return NextResponse.json({ error: "invalid_slug", message: "This slug is already taken" }, { status: 400 });
    }
    updateData.slug = trimmed;
  }

  // Update logo variant
  if (body.logoVariant !== undefined) {
    const v = Math.max(0, Math.min(7, Math.floor(body.logoVariant)));
    updateData.logoVariant = v;
  }

  // Domain operations
  let list = parseDomains(project.domains);
  try {
    if (body.addDomain) {
      const [domain] = sanitizeDomains([body.addDomain]);
      if (domain && !list.some((d) => d === domain)) {
        if (list.length >= limits.domains) {
          return NextResponse.json({ error: "limit_reached", message: `Free plan allows up to ${limits.domains} domains. Upgrade to Pro for more.` }, { status: 403 });
        }
        list.push(domain);
      }
    }
    if (body.removeDomain) {
      const target = normalizeDomain(body.removeDomain);
      list = list.filter((d) => d !== target);
    }
  } catch (e) {
    return NextResponse.json({ error: "invalid_domain", message: e instanceof Error ? e.message : "invalid_domain" }, { status: 400 });
  }
  list = Array.from(new Set(list));
  updateData.domains = list.join(",");

  const updated = await prisma.project.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, slug: true, domains: true },
  });

  return NextResponse.json({
    project: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      domains: parseDomains(updated.domains),
    },
  });
}
