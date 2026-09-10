import { z } from "zod";
import type { McpStore } from "../store";
import type { McpConfig } from "../config";
import { runTool } from "../errors";
import { parseDomains, resolveProject } from "../projects";

export const trackingCheckupShape = {
  project: z.string().describe("Workspace slug or id"),
};

export async function trackingCheckup(store: McpStore, config: McpConfig, args: { project: string }) {
  return runTool(async () => {
    const p = await resolveProject(store, config, args.project);
    const domains = parseDomains(p.domains);
    const events = await store.getEventsForAnalytics(p.id, {});

    let lastEventAt: string | null = null;
    if (events.length > 0) {
      let max = 0;
      for (const e of events) {
        const t = e.ts instanceof Date ? e.ts.getTime() : new Date(e.ts).getTime();
        if (t > max) max = t;
      }
      lastEventAt = new Date(max).toISOString();
    }

    const connected = lastEventAt !== null;
    const findings: string[] = [];
    if (!connected) findings.push("No events received yet — paste the browser snippet from Tracking.");
    if (domains.length === 0) {
      findings.push(
        "Domain allowlist is empty: anyone with the publishable key can write to this workspace. Add a domain in Settings → Domains.",
      );
    }

    return {
      project: p.slug,
      connected,
      lastEventAt,
      totalEvents: events.length,
      domains,
      pk: p.publishableKey,
      findings,
    };
  });
}
