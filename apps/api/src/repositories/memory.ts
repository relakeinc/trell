import type {
  AnalyticsFilter,
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
} from "./types";

/** In-memory repository for tests and demos (no database). */
export class MemoryRepo implements Repo {
  private projectsByPk = new Map<string, ProjectRecord>();
  private projectsById = new Map<string, ProjectRecord>();
  private events = new Map<string, StoredEvent[]>();
  private eventIds = new Map<string, Set<string>>();
  private funnels = new Map<string, FunnelRecord>();
  private funnelsByProject = new Map<string, Set<string>>();
  private savedViews = new Map<string, SavedViewRecord>();
  private savedViewsByProject = new Map<string, Set<string>>();
  private seq = 0;

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
