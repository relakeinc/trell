export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  plan: string;
  publishableKey: string; // pk
  apiKeyHash: string;     // sha256(sk)
  domains: string;        // comma-separated allowed origins
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
  raw: string | null;        // JSON (original envelope)
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

// ── Repo interface ────────────────────────────────────────────

export interface Repo {
  createOrganizationAndProject(input: CreateProjectInput): Promise<ProjectRecord>;
  findProjectByPublishableKey(pk: string): Promise<ProjectRecord | null>;
  findProjectById(id: string): Promise<ProjectRecord | null>;
  insertEvents(input: InsertEventsInput): Promise<{ inserted: number; duplicates: number }>;
  getEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<StoredEvent[]>;
  countEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<number>;

  // Funnel CRUD
  listFunnels(projectId: string): Promise<FunnelRecord[]>;
  getFunnel(id: string): Promise<FunnelRecord | null>;
  createFunnel(input: CreateFunnelInput): Promise<FunnelRecord>;
  updateFunnel(id: string, input: UpdateFunnelInput): Promise<FunnelRecord>;
  deleteFunnel(id: string): Promise<void>;

  // SavedView CRUD
  listSavedViews(projectId: string): Promise<SavedViewRecord[]>;
  getSavedView(id: string): Promise<SavedViewRecord | null>;
  createSavedView(input: CreateSavedViewInput): Promise<SavedViewRecord>;
  deleteSavedView(id: string): Promise<void>;
}
