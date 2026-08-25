const PLAN_LIMITS = {
  free: { events: 5000, domains: 3, projects: 999, retentionDays: 365 },
  pro: { events: 50000, domains: 100, projects: 999, retentionDays: 1095 },
} as const;

export type PlanLimits = typeof PLAN_LIMITS[keyof typeof PLAN_LIMITS];

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
}

export function formatRetention(days: number): string {
  if (days >= 1095) return "3 years";
  if (days >= 365) return "1 year";
  return `${Math.round(days / 30)} months`;
}
