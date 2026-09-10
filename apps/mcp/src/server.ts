import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpStore } from "./store";
import type { McpConfig } from "./config";
import { getProject, getProjectShape, listProjects } from "./tools/projects";
import { getStats, getStatsShape } from "./tools/stats";
import { trackingCheckup, trackingCheckupShape } from "./tools/tracking";

export interface McpServerDeps {
  store: McpStore;
  config: McpConfig;
}

/** Phase 1 tools: read-only (list_projects, get_project, get_stats, tracking_checkup). */
export function createMcpServer(deps: McpServerDeps): McpServer {
  const { store, config } = deps;
  const server = new McpServer({ name: "trell", version: "0.0.0" });

  server.tool("list_projects", "List accessible Trell workspaces (id, slug, name, plan)", async () =>
    listProjects(store, config),
  );

  server.tool(
    "get_project",
    "Workspace detail: plan, publishable key, domain allowlist, creation date",
    getProjectShape,
    async (args) => getProject(store, config, args),
  );

  server.tool(
    "get_stats",
    "Event stats for a workspace: total, counts by type, top forms and pages (default: last 30 days, max range 366 days)",
    getStatsShape,
    async (args) => getStats(store, config, args),
  );

  server.tool(
    "tracking_checkup",
    "Check whether a workspace is receiving events, when the last one arrived, and whether the domain allowlist is open",
    trackingCheckupShape,
    async (args) => trackingCheckup(store, config, args),
  );

  return server;
}
