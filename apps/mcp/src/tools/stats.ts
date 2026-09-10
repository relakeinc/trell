import { z } from "zod";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { runTool } from "../errors";
import { resolveProject } from "../projects";
import { resolveRange } from "./range";

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
    const { from, to } = resolveRange(args.from, args.to);

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
