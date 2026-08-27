import { prisma } from "./prisma";
import { getPlanLimits, type PlanLimits } from "@/lib/plans";

/** Resolve the effective (account-level) plan for a project's owner. */
export async function getProjectOwnerPlan(projectId: string): Promise<{ plan: string; limits: PlanLimits; billingPeriodStart: Date }> {
  const member = await prisma.projectUser.findFirst({
    where: { projectId, role: "owner" },
    include: { user: { select: { plan: true, billingPeriodStart: true } } },
  });
  const plan = member?.user.plan ?? "free";
  return {
    plan,
    limits: getPlanLimits(plan),
    billingPeriodStart: member?.user.billingPeriodStart ?? new Date(),
  };
}

export { getPlanLimits };
