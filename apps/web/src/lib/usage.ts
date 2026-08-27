import { prisma } from "./prisma";
import { getPlanLimits, type PlanLimits } from "@/lib/plans";

/** Resolve the effective (account-level) plan for a project's owner. */
export async function getProjectOwnerPlan(projectId: string): Promise<{ plan: string; limits: PlanLimits; billingPeriodStart: Date }> {
  const member = await prisma.projectUser.findFirst({
    where: { projectId, role: "owner" },
    include: {
      user: { select: { plan: true, billingPeriodStart: true } },
      project: { select: { plan: true, polarCustomerId: true, subscriptionId: true } },
    },
  });

  // Prefer the user-level plan. If empty, fall back to the project-level plan
  // (legacy data from before the account-level migration).
  const plan = member?.user.plan || member?.project.plan || "free";

  return {
    plan,
    limits: getPlanLimits(plan),
    billingPeriodStart: member?.user.billingPeriodStart ?? new Date(),
  };
}

export { getPlanLimits };
