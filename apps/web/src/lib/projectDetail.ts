import { prisma } from "./prisma";
import { parseDomains } from "./domains";
import { getProjectOwnerPlan } from "./usage";

/** Full project detail payload shared by GET /api/projects/[id] and /api/projects/by-slug. */
export async function getProjectDetail(projectId: string, userId: string) {
  const [project, planInfo, lastEvent, ownerMemberships] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        publishableKey: true,
        domains: true,
        logoVariant: true,
        createdAt: true,
      },
    }),
    getProjectOwnerPlan(projectId),
    prisma.event.aggregate({ where: { projectId }, _max: { ts: true } }),
    prisma.projectUser.findMany({
      where: { userId, role: "owner" },
      select: { projectId: true },
    }),
  ]);
  if (!project) return null;

  const allProjectIds = ownerMemberships.map((m) => m.projectId);
  const [totalEvents, allProjects] = await Promise.all([
    prisma.event.count({ where: { projectId: { in: allProjectIds } } }),
    prisma.project.findMany({
      where: { id: { in: allProjectIds } },
      select: { domains: true },
    }),
  ]);

  const allDomains = new Set<string>();
  for (const p of allProjects) {
    for (const d of parseDomains(p.domains)) allDomains.add(d);
  }

  const { plan, limits, billingPeriodStart } = planInfo;
  return {
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
      domains: allDomains.size,
      domainLimit: limits.domains,
      billingPeriodStart: billingPeriodStart.toISOString(),
    },
  };
}
