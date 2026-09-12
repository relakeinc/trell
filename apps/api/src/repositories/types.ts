export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  plan: string;
  publishableKey: string; // pk
  apiKeyHash: string; // sha256(sk)
  domains: string; // comma-separated allowed origins
  createdAt: Date;
}

export interface InsertEventsInput {
  projectId: string;
  events: StoredEvent[];
}

export interface StoredEvent {
  eventId: string;
  type: string;
  ts: Date;
  sessionId: string;
  visitorId: string;
  url: string;
  referrer: string | null;
  pagePath: string;
  pageTitle: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  deviceType: string;
  os: string | null;
  browser: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  formId: string | null;
  formName: string | null;
  properties: string | null; // JSON
  raw: string | null; // JSON (original envelope)
}

/** Filter applied before analytics aggregation (pushed down to the repo). */
export interface AnalyticsFilter {
  from?: Date;
  to?: Date;
  type?: string[];
  form?: string;
  page?: string;
  device?: string;
  browser?: string;
  os?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  organizationName: string;
  pk: string;
  skHash: string;
  domains: string;
}

// ── Funnel types ──────────────────────────────────────────────

export interface FunnelStepRecord {
  id: string;
  funnelId: string;
  eventType: string | null;
  formId: string | null;
  label: string | null;
  position: number;
}

export interface FunnelRecord {
  id: string;
  projectId: string;
  name: string;
  steps: FunnelStepRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFunnelInput {
  projectId: string;
  name: string;
  steps: { eventType: string; formId?: string; label?: string; position: number }[];
}

export interface UpdateFunnelInput {
  name?: string;
  steps?: { eventType: string; formId?: string; label?: string; position: number }[];
}

// ── SavedView types ───────────────────────────────────────────

export interface SavedViewRecord {
  id: string;
  projectId: string;
  name: string;
  type: string;
  config: string; // JSON, validated by Zod per type
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSavedViewInput {
  projectId: string;
  name: string;
  type: string;
  config: string; // JSON string
}

// ── Metadata lists (safe fields only) ───────────────────────────

export interface WebhookMeta {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
}

export interface UtmTemplateMeta {
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

export interface ApiKeyMeta {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
}

// ── Identity (per-user MCP access) ──────────────────────────────

export interface UserRef {
  id: string;
  email: string;
}

export interface MembershipRef {
  projectId: string;
  role: string;
}

// ── Repo interface ────────────────────────────────────────────

export interface Repo {
  createOrganizationAndProject(input: CreateProjectInput): Promise<ProjectRecord>;
  findProjectByPublishableKey(pk: string): Promise<ProjectRecord | null>;
  findProjectById(id: string): Promise<ProjectRecord | null>;
  findProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  listProjects(): Promise<ProjectRecord[]>;
  /** Named server keys (dashboard API Keys): resolve an sk sha256 → project. */
  findApiKeyProject(keyHash: string): Promise<{ projectId: string } | null>;
  insertEvents(input: InsertEventsInput): Promise<{ inserted: number; duplicates: number }>;
  getEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<StoredEvent[]>;
  countEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<number>;

  // Metadata lists (safe fields only — never hashes or secrets)
  listWebhooks(projectId: string): Promise<WebhookMeta[]>;
  listUtmTemplates(projectId: string): Promise<UtmTemplateMeta[]>;
  listApiKeys(projectId: string): Promise<ApiKeyMeta[]>;

  findUserByEmail(email: string): Promise<UserRef | null>;
  listMemberships(userId: string): Promise<MembershipRef[]>;

  // MCP writes (tools verify project access first — same contract as routes)
  createUtmTemplate(input: {
    projectId: string;
    name: string;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
    referral?: string | null;
  }): Promise<UtmTemplateMeta>;
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
  ): Promise<UtmTemplateMeta>;
  deleteUtmTemplate(id: string): Promise<void>;
  createWebhook(input: { projectId: string; url: string; events: string[] }): Promise<WebhookMeta>;
  deleteWebhook(id: string): Promise<void>;
  createApiKey(input: { projectId: string; name: string; keyHash: string; keyPrefix: string }): Promise<ApiKeyMeta>;
  deleteApiKey(id: string): Promise<void>;
  setProjectDomains(projectId: string, domains: string[]): Promise<string[]>;
  deleteProject(id: string): Promise<void>;
  rotateProjectSecret(id: string, skHash: string): Promise<void>;

  listFunnels(projectId: string): Promise<FunnelRecord[]>;
  getFunnel(id: string): Promise<FunnelRecord | null>;
  createFunnel(input: CreateFunnelInput): Promise<FunnelRecord>;
  updateFunnel(id: string, input: UpdateFunnelInput): Promise<FunnelRecord>;
  deleteFunnel(id: string): Promise<void>;

  listSavedViews(projectId: string): Promise<SavedViewRecord[]>;
  getSavedView(id: string): Promise<SavedViewRecord | null>;
  createSavedView(input: CreateSavedViewInput): Promise<SavedViewRecord>;
  deleteSavedView(id: string): Promise<void>;
}
