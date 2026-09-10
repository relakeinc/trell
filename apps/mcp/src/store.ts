/**
 * Minimal data-store contract for the MCP tools. Structural subset of the
 * apps/api Repo — PrismaRepo and MemoryRepo satisfy it without depending
 * on this package (keeps the dependency graph acyclic: api → mcp).
 */
export interface McpProject {
  id: string;
  slug: string;
  name: string;
  plan: string;
  publishableKey: string;
  domains: string;
  createdAt: Date;
}

export interface McpEventFilter {
  from?: Date;
  to?: Date;
  type?: string[];
}

export interface McpEvent {
  type: string;
  ts: Date;
  formId: string | null;
  pagePath: string;
}

export interface McpStore {
  listProjects(): Promise<McpProject[]>;
  findProjectById(id: string): Promise<McpProject | null>;
  findProjectBySlug(slug: string): Promise<McpProject | null>;
  getEventsForAnalytics(projectId: string, filter: McpEventFilter): Promise<McpEvent[]>;
}
