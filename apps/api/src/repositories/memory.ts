import type {
  AnalyticsFilter,
  ApiKeyMeta,
  CreateFunnelInput,
  CreateProjectInput,
  CreateSavedViewInput,
  FunnelRecord,
  FunnelStepRecord,
  InsertEventsInput,
  ProjectRecord,
  Repo,
  SavedViewRecord,
  StoredEvent,
  UpdateFunnelInput,
  UtmTemplateMeta,
  WebhookMeta,
} from "./types";

/** In-memory repository for tests and demos (no database). */
export class MemoryRepo implements Repo {
  private projectsByPk = new Map<string, ProjectRecord>();
  private projectsById = new Map<string, ProjectRecord>();
  private projectsBySlug = new Map<string, ProjectRecord>();
  private events = new Map<string, StoredEvent[]>();
  private eventIds = new Map<string, Set<string>>();
  private funnels = new Map<string, FunnelRecord>();
  private funnelsByProject = new Map<string, Set<string>>();
  private savedViews = new Map<string, SavedViewRecord>();
  private savedViewsByProject = new Map<string, Set<string>>();
  /** sha256(sk) → projectId for named server keys. */
  private apiKeyHashes = new Map<string, string>();
  private webhooks: { projectId: string; meta: WebhookMeta }[] = [];
  private utmTemplates: { projectId: string; meta: UtmTemplateMeta }[] = [];
  private apiKeys: { projectId: string; meta: ApiKeyMeta; keyHash?: string }[] = [];
  private seq = 0;

  /** Test/demo helper: register a named server key hash for a project. */
  seedApiKey(keyHash: string, projectId: string): void {
    this.apiKeyHashes.set(keyHash, projectId);
  }

  async findApiKeyProject(keyHash: string): Promise<{ projectId: string } | null> {
    const projectId = this.apiKeyHashes.get(keyHash);
    return projectId ? { projectId } : null;
  }

  /** Test/demo helpers: metadata lists live in arrays (no DB). */
  seedWebhook(projectId: string, meta: WebhookMeta): void {
    this.webhooks.push({ projectId, meta });
  }

  seedUtmTemplate(projectId: string, meta: UtmTemplateMeta): void {
    this.utmTemplates.push({ projectId, meta });
  }

  seedApiKeyMeta(projectId: string, meta: ApiKeyMeta): void {
    this.apiKeys.push({ projectId, meta });
  }

  async listWebhooks(projectId: string): Promise<WebhookMeta[]> {
    return this.webhooks.filter((w) => w.projectId === projectId).map((w) => w.meta);
  }

  async listUtmTemplates(projectId: string): Promise<UtmTemplateMeta[]> {
    return this.utmTemplates.filter((t) => t.projectId === projectId).map((t) => t.meta);
  }

  async listApiKeys(projectId: string): Promise<ApiKeyMeta[]> {
    return this.apiKeys.filter((k) => k.projectId === projectId).map((k) => k.meta);
  }

  // ── MCP writes ─────────────────────────────────────────────

  async createUtmTemplate(input: {
    projectId: string;
    name: string;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
    referral?: string | null;
  }): Promise<UtmTemplateMeta> {
    const meta: UtmTemplateMeta = {
      id: `ut_${++this.seq}`,
      name: input.name,
      source: input.source ?? null,
      medium: input.medium ?? null,
      campaign: input.campaign ?? null,
      term: input.term ?? null,
      content: input.content ?? null,
      referral: input.referral ?? null,
      createdAt: new Date(),
    };
    this.utmTemplates.push({ projectId: input.projectId, meta });
    return meta;
  }

  async updateUtmTemplate(
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
  ): Promise<UtmTemplateMeta> {
    const row = this.utmTemplates.find((t) => t.meta.id === id);
    if (!row) throw new Error(`UTM template ${id} not found`);
    if (input.name !== undefined) row.meta.name = input.name;
    for (const k of ["source", "medium", "campaign", "term", "content", "referral"] as const) {
      if (input[k] !== undefined) row.meta[k] = input[k];
    }
    return row.meta;
  }

  async deleteUtmTemplate(id: string): Promise<void> {
    this.utmTemplates = this.utmTemplates.filter((t) => t.meta.id !== id);
  }

  async createWebhook(input: { projectId: string; url: string; events: string[] }): Promise<WebhookMeta> {
    const meta: WebhookMeta = {
      id: `wh_${++this.seq}`,
      url: input.url,
      events: input.events,
      enabled: true,
      createdAt: new Date(),
    };
    this.webhooks.push({ projectId: input.projectId, meta });
    return meta;
  }

  async deleteWebhook(id: string): Promise<void> {
    this.webhooks = this.webhooks.filter((w) => w.meta.id !== id);
  }

  async createApiKey(input: { projectId: string; name: string; keyHash: string; keyPrefix: string }): Promise<ApiKeyMeta> {
    const meta: ApiKeyMeta = {
      id: `ak_${++this.seq}`,
      name: input.name,
      keyPrefix: input.keyPrefix,
      createdAt: new Date(),
    };
    this.apiKeys.push({ projectId: input.projectId, meta, keyHash: input.keyHash });
    this.apiKeyHashes.set(input.keyHash, input.projectId);
    return meta;
  }

  async deleteApiKey(id: string): Promise<void> {
    const row = this.apiKeys.find((k) => k.meta.id === id);
    if (row?.keyHash) this.apiKeyHashes.delete(row.keyHash);
    this.apiKeys = this.apiKeys.filter((k) => k.meta.id !== id);
  }

  async setProjectDomains(projectId: string, domains: string[]): Promise<string[]> {
    const project = this.projectsById.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    project.domains = domains.join(",");
    return [...domains];
  }

  async deleteProject(id: string): Promise<void> {
    const project = this.projectsById.get(id);
    if (project) {
      this.projectsById.delete(id);
      this.projectsByPk.delete(project.publishableKey);
      this.projectsBySlug.delete(project.slug);
    }
    this.events.delete(id);
    this.eventIds.delete(id);
    const funnelIds = this.funnelsByProject.get(id) ?? new Set();
    for (const fid of funnelIds) this.funnels.delete(fid);
    this.funnelsByProject.delete(id);
    const viewIds = this.savedViewsByProject.get(id) ?? new Set();
    for (const vid of viewIds) this.savedViews.delete(vid);
    this.savedViewsByProject.delete(id);
    this.webhooks = this.webhooks.filter((w) => w.projectId !== id);
    this.utmTemplates = this.utmTemplates.filter((t) => t.projectId !== id);
    this.apiKeys = this.apiKeys.filter((k) => {
      if (k.projectId === id && k.keyHash) this.apiKeyHashes.delete(k.keyHash);
      return k.projectId !== id;
    });
    this.memberships = this.memberships.filter((m) => m.projectId !== id);
  }

  async rotateProjectSecret(id: string, skHash: string): Promise<void> {
    const project = this.projectsById.get(id);
    if (!project) throw new Error(`Project ${id} not found`);
    project.apiKeyHash = skHash;
  }

  // ── Identity ─────────────────────────────────────────────────

  private users = new Map<string, { id: string; email: string }>();
  private memberships: { userId: string; projectId: string; role: string }[] = [];

  /** Test/demo helper. */
  seedUser(id: string, email: string): void {
    this.users.set(email.toLowerCase(), { id, email });
  }

  /** Test/demo helper. */
  seedMembership(userId: string, projectId: string, role = "member"): void {
    this.memberships.push({ userId, projectId, role });
  }

  async findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return this.users.get(email.trim().toLowerCase()) ?? null;
  }

  async listMemberships(userId: string): Promise<{ projectId: string; role: string }[]> {
    return this.memberships
      .filter((m) => m.userId === userId)
      .map((m) => ({ projectId: m.projectId, role: m.role }));
  }

  async createOrganizationAndProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const project: ProjectRecord = {
      id: `proj_${++this.seq}`,
      organizationId: `org_${this.seq}`,
      name: input.name,
      slug: input.slug,
      plan: "free",
      publishableKey: input.pk,
      apiKeyHash: input.skHash,
      domains: input.domains,
      createdAt: new Date(),
    };
    this.projectsByPk.set(input.pk, project);
    this.projectsById.set(project.id, project);
    this.projectsBySlug.set(project.slug, project);
    this.events.set(project.id, []);
    this.eventIds.set(project.id, new Set());
    this.funnelsByProject.set(project.id, new Set());
    this.savedViewsByProject.set(project.id, new Set());
    return project;
  }

  async findProjectByPublishableKey(pk: string): Promise<ProjectRecord | null> {
    return this.projectsByPk.get(pk) ?? null;
  }

  async findProjectById(id: string): Promise<ProjectRecord | null> {
    return this.projectsById.get(id) ?? null;
  }

  async findProjectBySlug(slug: string): Promise<ProjectRecord | null> {
    return this.projectsBySlug.get(slug) ?? null;
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return [...this.projectsById.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async insertEvents(input: InsertEventsInput): Promise<{ inserted: number; duplicates: number }> {
    const list = this.events.get(input.projectId);
    const ids = this.eventIds.get(input.projectId);
    if (!list || !ids) return { inserted: 0, duplicates: input.events.length };
    let inserted = 0;
    let duplicates = 0;
    for (const ev of input.events) {
      if (ids.has(ev.eventId)) {
        duplicates++;
        continue;
      }
      ids.add(ev.eventId);
      list.push(ev);
      inserted++;
    }
    return { inserted, duplicates };
  }

  async getEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<StoredEvent[]> {
    const list = this.events.get(projectId) ?? [];
    return list.filter((e) => this.matchesFilter(e, filter));
  }

  async countEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<number> {
    const list = this.events.get(projectId) ?? [];
    return list.filter((e) => this.matchesFilter(e, filter)).length;
  }

  // ── Funnel CRUD ──────────────────────────────────────────────

  async listFunnels(projectId: string): Promise<FunnelRecord[]> {
    const ids = this.funnelsByProject.get(projectId) ?? new Set();
    return [...ids].map((id) => this.funnels.get(id)!).filter(Boolean).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getFunnel(id: string): Promise<FunnelRecord | null> {
    return this.funnels.get(id) ?? null;
  }

  async createFunnel(input: CreateFunnelInput): Promise<FunnelRecord> {
    const id = `f_${++this.seq}`;
    const funnel: FunnelRecord = {
      id,
      projectId: input.projectId,
      name: input.name,
      steps: input.steps.map((s, i) => ({
        id: `fs_${this.seq}_${i}`,
        funnelId: id,
        eventType: s.eventType,
        formId: s.formId ?? null,
        label: s.label ?? null,
        position: s.position,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.funnels.set(id, funnel);
    const projectFunnels = this.funnelsByProject.get(input.projectId) ?? new Set();
    projectFunnels.add(id);
    this.funnelsByProject.set(input.projectId, projectFunnels);
    return funnel;
  }

  async updateFunnel(id: string, input: UpdateFunnelInput): Promise<FunnelRecord> {
    const existing = this.funnels.get(id);
    if (!existing) throw new Error(`Funnel ${id} not found`);
    if (input.name !== undefined) existing.name = input.name;
    if (input.steps !== undefined) {
      existing.steps = input.steps.map((s, i) => ({
        id: `fs_${this.seq}_${i}`,
        funnelId: id,
        eventType: s.eventType,
        formId: s.formId ?? null,
        label: s.label ?? null,
        position: s.position,
      }));
    }
    existing.updatedAt = new Date();
    return existing;
  }

  async deleteFunnel(id: string): Promise<void> {
    const funnel = this.funnels.get(id);
    if (funnel) {
      const projectFunnels = this.funnelsByProject.get(funnel.projectId);
      projectFunnels?.delete(id);
      this.funnels.delete(id);
    }
  }

  // ── SavedView CRUD ───────────────────────────────────────────

  async listSavedViews(projectId: string): Promise<SavedViewRecord[]> {
    const ids = this.savedViewsByProject.get(projectId) ?? new Set();
    return [...ids].map((id) => this.savedViews.get(id)!).filter(Boolean).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getSavedView(id: string): Promise<SavedViewRecord | null> {
    return this.savedViews.get(id) ?? null;
  }

  async createSavedView(input: CreateSavedViewInput): Promise<SavedViewRecord> {
    const id = `sv_${++this.seq}`;
    const view: SavedViewRecord = {
      id,
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      config: input.config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.savedViews.set(id, view);
    const projectViews = this.savedViewsByProject.get(input.projectId) ?? new Set();
    projectViews.add(id);
    this.savedViewsByProject.set(input.projectId, projectViews);
    return view;
  }

  async deleteSavedView(id: string): Promise<void> {
    const view = this.savedViews.get(id);
    if (view) {
      const projectViews = this.savedViewsByProject.get(view.projectId);
      projectViews?.delete(id);
      this.savedViews.delete(id);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private matchesFilter(e: StoredEvent, filter: AnalyticsFilter): boolean {
    if (filter.from && e.ts < filter.from) return false;
    if (filter.to && e.ts > filter.to) return false;
    if (filter.type && filter.type.length > 0 && !filter.type.includes(e.type)) return false;
    if (filter.form && e.formId !== filter.form) return false;
    if (filter.page && e.pagePath !== filter.page) return false;
    if (filter.device && e.deviceType !== filter.device) return false;
    if (filter.browser && e.browser !== filter.browser) return false;
    if (filter.os && e.os !== filter.os) return false;
    if (filter.utmSource && e.utmSource !== filter.utmSource) return false;
    if (filter.utmMedium && e.utmMedium !== filter.utmMedium) return false;
    if (filter.utmCampaign && e.utmCampaign !== filter.utmCampaign) return false;
    return true;
  }
}
