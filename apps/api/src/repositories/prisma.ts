import { Prisma, PrismaClient } from "@prisma/client";
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

/**
 * Postgres-backed repository (canonical, production). Uses skipDuplicates on
 * event_id for idempotent ingestion. Set DATABASE_URL to point at the DB.
 */
export class PrismaRepo implements Repo {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createOrganizationAndProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const org = await this.prisma.organization.upsert({
      where: { slug: input.slug },
      update: {},
      create: { name: input.organizationName, slug: input.slug },
    });
    const project = await this.prisma.project.create({
      data: {
        name: input.name,
        slug: input.slug,
        publishableKey: input.pk,
        apiKeyHash: input.skHash,
        domains: input.domains,
        organizationId: org.id,
      },
    });
    return this.toRecord(project);
  }

  async findProjectById(id: string): Promise<ProjectRecord | null> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    return project ? this.toRecord(project) : null;
  }

  async findProjectByPublishableKey(pk: string): Promise<ProjectRecord | null> {
    const project = await this.prisma.project.findUnique({ where: { publishableKey: pk } });
    return project ? this.toRecord(project) : null;
  }

  async insertEvents(input: InsertEventsInput): Promise<{ inserted: number; duplicates: number }> {
    if (input.events.length === 0) return { inserted: 0, duplicates: 0 };
    const res = await this.prisma.event.createMany({
      data: input.events.map((e) => this.toCreateMany(input.projectId, e)),
      skipDuplicates: true,
    });
    return { inserted: res.count, duplicates: input.events.length - res.count };
  }

  async getEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<StoredEvent[]> {
    const rows = await this.prisma.event.findMany({
      where: this.buildWhere(projectId, filter),
      orderBy: { ts: "asc" },
    });
    return rows.map((r) => this.fromRow(r));
  }

  async countEventsForAnalytics(projectId: string, filter: AnalyticsFilter): Promise<number> {
    return this.prisma.event.count({ where: this.buildWhere(projectId, filter) });
  }

  // ── Funnel CRUD ──────────────────────────────────────────────

  async listFunnels(projectId: string): Promise<FunnelRecord[]> {
    const rows = await this.prisma.funnel.findMany({
      where: { projectId },
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      steps: r.steps.map((s) => ({ id: s.id, funnelId: s.funnelId, eventType: s.eventType, formId: s.formId, label: s.label, position: s.position })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getFunnel(id: string): Promise<FunnelRecord | null> {
    const r = await this.prisma.funnel.findUnique({
      where: { id },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    if (!r) return null;
    return {
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      steps: r.steps.map((s) => ({ id: s.id, funnelId: s.funnelId, eventType: s.eventType, formId: s.formId, label: s.label, position: s.position })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async createFunnel(input: CreateFunnelInput): Promise<FunnelRecord> {
    const funnel = await this.prisma.funnel.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        steps: {
          create: input.steps.map((s) => ({
            eventType: s.eventType,
            formId: s.formId ?? null,
            label: s.label ?? null,
            position: s.position,
          })),
        },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    return {
      id: funnel.id,
      projectId: funnel.projectId,
      name: funnel.name,
      steps: funnel.steps.map((s) => ({ id: s.id, funnelId: s.funnelId, eventType: s.eventType, formId: s.formId, label: s.label, position: s.position })),
      createdAt: funnel.createdAt,
      updatedAt: funnel.updatedAt,
    };
  }

  async updateFunnel(id: string, input: UpdateFunnelInput): Promise<FunnelRecord> {
    const data: Prisma.FunnelUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.steps !== undefined) {
      // Delete existing steps, recreate
      await this.prisma.funnelStep.deleteMany({ where: { funnelId: id } });
      data.steps = {
        create: input.steps.map((s) => ({
          eventType: s.eventType,
          formId: s.formId ?? null,
          label: s.label ?? null,
          position: s.position,
        })),
      };
    }
    const funnel = await this.prisma.funnel.update({
      where: { id },
      data,
      include: { steps: { orderBy: { position: "asc" } } },
    });
    return {
      id: funnel.id,
      projectId: funnel.projectId,
      name: funnel.name,
      steps: funnel.steps.map((s) => ({ id: s.id, funnelId: s.funnelId, eventType: s.eventType, formId: s.formId, label: s.label, position: s.position })),
      createdAt: funnel.createdAt,
      updatedAt: funnel.updatedAt,
    };
  }

  async deleteFunnel(id: string): Promise<void> {
    await this.prisma.funnel.delete({ where: { id } });
  }

  // ── SavedView CRUD ───────────────────────────────────────────

  async listSavedViews(projectId: string): Promise<SavedViewRecord[]> {
    const rows = await this.prisma.savedView.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ id: r.id, projectId: r.projectId, name: r.name, type: r.type, config: r.config, createdAt: r.createdAt, updatedAt: r.updatedAt }));
  }

  async getSavedView(id: string): Promise<SavedViewRecord | null> {
    const r = await this.prisma.savedView.findUnique({ where: { id } });
    if (!r) return null;
    return { id: r.id, projectId: r.projectId, name: r.name, type: r.type, config: r.config, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  async createSavedView(input: CreateSavedViewInput): Promise<SavedViewRecord> {
    const r = await this.prisma.savedView.create({
      data: { projectId: input.projectId, name: input.name, type: input.type, config: input.config },
    });
    return { id: r.id, projectId: r.projectId, name: r.name, type: r.type, config: r.config, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  async deleteSavedView(id: string): Promise<void> {
    await this.prisma.savedView.delete({ where: { id } });
  }

  // ── Helpers ──────────────────────────────────────────────────

  private buildWhere(projectId: string, filter: AnalyticsFilter) {
    const where: Prisma.EventWhereInput = { projectId };
    if (filter.form) where.formId = filter.form;
    if (filter.type && filter.type.length > 0) where.type = { in: filter.type };
    if (filter.from || filter.to) {
      where.ts = {};
      if (filter.from) (where.ts as Prisma.DateTimeFilter).gte = filter.from;
      if (filter.to) (where.ts as Prisma.DateTimeFilter).lte = filter.to;
    }
    if (filter.page) where.pagePath = filter.page;
    if (filter.device) where.deviceType = filter.device;
    if (filter.browser) where.browser = filter.browser;
    if (filter.os) where.os = filter.os;
    if (filter.utmSource) where.utmSource = filter.utmSource;
    if (filter.utmMedium) where.utmMedium = filter.utmMedium;
    if (filter.utmCampaign) where.utmCampaign = filter.utmCampaign;
    return where;
  }

  private toRecord(project: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    plan: string;
    publishableKey: string;
    apiKeyHash: string;
    domains: string;
    createdAt: Date;
  }): ProjectRecord {
    return {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      slug: project.slug,
      plan: project.plan,
      publishableKey: project.publishableKey,
      apiKeyHash: project.apiKeyHash,
      domains: project.domains,
      createdAt: project.createdAt,
    };
  }

  private toCreateMany(projectId: string, e: StoredEvent): Prisma.EventCreateManyInput {
    return {
      eventId: e.eventId,
      projectId,
      type: e.type,
      ts: e.ts,
      sessionId: e.sessionId,
      visitorId: e.visitorId,
      url: e.url,
      referrer: e.referrer,
      pagePath: e.pagePath,
      pageTitle: e.pageTitle,
      utmSource: e.utmSource,
      utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign,
      utmTerm: e.utmTerm,
      utmContent: e.utmContent,
      deviceType: e.deviceType,
      os: e.os,
      browser: e.browser,
      viewportWidth: e.viewportWidth,
      viewportHeight: e.viewportHeight,
      formId: e.formId,
      formName: e.formName,
      properties: e.properties,
      raw: e.raw,
    };
  }

  private fromRow(r: {
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
    properties: string | null;
    raw: string | null;
  }): StoredEvent {
    return {
      eventId: r.eventId,
      type: r.type,
      ts: r.ts,
      sessionId: r.sessionId,
      visitorId: r.visitorId,
      url: r.url,
      referrer: r.referrer,
      pagePath: r.pagePath,
      pageTitle: r.pageTitle,
      utmSource: r.utmSource,
      utmMedium: r.utmMedium,
      utmCampaign: r.utmCampaign,
      utmTerm: r.utmTerm,
      utmContent: r.utmContent,
      deviceType: r.deviceType,
      os: r.os,
      browser: r.browser,
      viewportWidth: r.viewportWidth,
      viewportHeight: r.viewportHeight,
      formId: r.formId,
      formName: r.formName,
      properties: r.properties,
      raw: r.raw,
    };
  }
}
