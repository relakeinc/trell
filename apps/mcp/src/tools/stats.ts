import { z } from "zod";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { McpError, runTool } from "../errors";
import { resolveProject } from "../projects";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

function parseDate(value: string | undefined, name: string): Date | undefined {
  if (value === undefined) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new McpError("invalid_input", `'${name}' must be an ISO date string`);
  return d;
}

export const getStatsShape = {
  project: z.string().describe("Workspace slug or id"),
  from: z.string().optional().describe("ISO start date (default: 30 days ago)"),
  to: z.string().optional().describe("ISO end date (default: now)"),
  type: z.array(z.string()).optional().describe("Filter by event types"),
};

export interface GetStatsArgs {
  project: string;
  from?: string;
  to?: string;
  type?: string[];
}

export async function getStats(store: McpStore, config: McpConfig, args: GetStatsArgs) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const to = parseDate(args.to, "to") ?? new Date();
    const from = parseDate(args.from, "from") ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    if (from > to) throw new McpError("invalid_input", "'from' must be before 'to'");
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new McpError("invalid_input", `date range must be ${MAX_RANGE_DAYS} days or less`);
    }

    const events = await store.getEventsForAnalytics(p.id, {
      from,
      to,
      ...(args.type && args.type.length > 0 ? { type: args.type } : {}),
    });

    const byType: Record<string, number> = {};
    const forms: Record<string, number> = {};
    const pages: Record<string, number> = {};
    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.formId) forms[e.formId] = (forms[e.formId] ?? 0) + 1;
      if (e.pagePath) pages[e.pagePath] = (pages[e.pagePath] ?? 0) + 1;
    }
    const top = (m: Record<string, number>, n: number) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));

    return {
      project: p.slug,
      from: from.toISOString(),
      to: to.toISOString(),
      total: events.length,
      byType,
      topForms: top(forms, 5),
      topPages: top(pages, 5),
    };
  });
}
