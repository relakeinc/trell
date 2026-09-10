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
  form?: string;
}

export interface McpEvent {
  eventId: string;
  type: string;
  ts: Date;
  sessionId: string;
  visitorId: string;
  url: string;
  pagePath: string;
  pageTitle: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  deviceType: string;
  os: string | null;
  browser: string | null;
  formId: string | null;
  formName: string | null;
}

export interface McpFunnelStep {
  eventType: string | null;
  formId: string | null;
  label: string | null;
  position: number;
}

export interface McpFunnel {
  id: string;
  name: string;
  steps: McpFunnelStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface McpView {
  id: string;
  name: string;
  type: string;
  createdAt: Date;
}

/** Webhook metadata — NEVER the signing secret. */
export interface McpWebhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
}

export interface McpUtmTemplate {
  id: string;
  name: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referral: string | null;
  createdAt: Date;
}

/** API key metadata — NEVER hashes or secrets. */
export interface McpApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
}

export interface McpUser {
  id: string;
  email: string;
}

export interface McpMembership {
  projectId: string;
  role: string;
}

export interface McpStore {
  listProjects(): Promise<McpProject[]>;
  findProjectById(id: string): Promise<McpProject | null>;
  findProjectBySlug(slug: string): Promise<McpProject | null>;
  getEventsForAnalytics(projectId: string, filter: McpEventFilter): Promise<McpEvent[]>;
  listFunnels(projectId: string): Promise<McpFunnel[]>;
  listSavedViews(projectId: string): Promise<McpView[]>;
  listWebhooks(projectId: string): Promise<McpWebhook[]>;
  listUtmTemplates(projectId: string): Promise<McpUtmTemplate[]>;
  listApiKeys(projectId: string): Promise<McpApiKey[]>;
  /** Identity: resolve a Trell user by email (lowercased match). */
  findUserByEmail(email: string): Promise<McpUser | null>;
  listMemberships(userId: string): Promise<McpMembership[]>;

  // ── Writes ─────────────────────────────────────────────────
  // Contract: callers (tools) verify project access FIRST via resolveProject;
  // unscoped-by-id methods below assume that check happened.
  getFunnel(id: string): Promise<McpFunnel | null>;
  createFunnel(input: {
    projectId: string;
    name: string;
    steps: { eventType: string; formId?: string; label?: string; position: number }[];
  }): Promise<McpFunnel>;
  updateFunnel(
    id: string,
    input: { name?: string; steps?: { eventType: string; formId?: string; label?: string; position: number }[] },
  ): Promise<McpFunnel>;
  deleteFunnel(id: string): Promise<void>;
  createUtmTemplate(input: {
    projectId: string;
    name: string;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
    referral?: string | null;
  }): Promise<McpUtmTemplate>;
  updateUtmTemplate(
    id: string,
    input: {
      name?: string;
      source?: string | null;
      medium?: string | null;
      campaign?: string | null;
      term?: string | null;
      content?: string | null;
      referral?: string | null;
    },
  ): Promise<McpUtmTemplate>;
  deleteUtmTemplate(id: string): Promise<void>;
  setProjectDomains(projectId: string, domains: string[]): Promise<string[]>;
  createWebhook(input: { projectId: string; url: string; events: string[] }): Promise<McpWebhook>;
  deleteWebhook(id: string): Promise<void>;
  createApiKey(input: { projectId: string; name: string; keyHash: string; keyPrefix: string }): Promise<McpApiKey>;
  deleteApiKey(id: string): Promise<void>;
  deleteProject(id: string): Promise<void>;
  rotateProjectSecret(id: string, skHash: string): Promise<void>;
}
