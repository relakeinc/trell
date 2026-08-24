const PLAN_LIMITS = {
  free: { events: 5000, domains: 3, projects: 5 },
  pro: { events: 100000, domains: 50, projects: 100 },
} as const;

export type PlanLimits = typeof PLAN_LIMITS[keyof typeof PLAN_LIMITS];

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
}
