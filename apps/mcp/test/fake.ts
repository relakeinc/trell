import type {
  McpApiKey,
  McpEvent,
  McpEventFilter,
  McpFunnel,
  McpProject,
  McpStore,
  McpUtmTemplate,
  McpView,
  McpWebhook,
} from "../src/store";

/** In-memory McpStore for tests (mirrors MemoryRepo semantics). */
export function makeEvent(overrides: Partial<McpEvent> & { eventId: string; type: string; ts: Date }): McpEvent {
  return {
    sessionId: "sid",
    visitorId: "vid",
    url: "https://example.com/a",
    pagePath: "/a",
    pageTitle: "A",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    deviceType: "desktop",
    os: null,
    browser: null,
    formId: null,
    formName: null,
    ...overrides,
  };
}

export class FakeStore implements McpStore {
  projects: McpProject[] = [];
  events = new Map<string, McpEvent[]>();
  funnels = new Map<string, McpFunnel[]>();
  views = new Map<string, McpView[]>();
  webhooks = new Map<string, McpWebhook[]>();
  utm = new Map<string, McpUtmTemplate[]>();
  keys = new Map<string, McpApiKey[]>();
  users = new Map<string, { id: string; email: string }>();
  memberships: { userId: string; projectId: string; role: string }[] = [];
  seq = 0;

  seedProject(p: McpProject): void {
    this.projects.push(p);
    this.events.set(p.id, []);
  }

  async listProjects(): Promise<McpProject[]> {
    return [...this.projects].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findProjectById(id: string): Promise<McpProject | null> {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  async findProjectBySlug(slug: string): Promise<McpProject | null> {
    return this.projects.find((p) => p.slug === slug) ?? null;
  }

  async getEventsForAnalytics(projectId: string, filter: McpEventFilter): Promise<McpEvent[]> {
    return (this.events.get(projectId) ?? []).filter((e) => {
      if (filter.from && e.ts < filter.from) return false;
      if (filter.to && e.ts > filter.to) return false;
      if (filter.type && filter.type.length > 0 && !filter.type.includes(e.type)) return false;
      if (filter.form && e.formId !== filter.form) return false;
      return true;
    });
  }

  async getFunnel(id: string): Promise<McpFunnel | null> {
    for (const list of this.funnels.values()) {
      const found = list.find((f) => f.id === id);
      if (found) return found;
    }
    return null;
  }

  async listFunnels(projectId: string): Promise<McpFunnel[]> {
    return this.funnels.get(projectId) ?? [];
  }

  async createFunnel(input: {
    projectId: string;
    name: string;
    steps: { eventType: string; formId?: string; label?: string; position: number }[];
  }): Promise<McpFunnel> {
    const funnel: McpFunnel = {
      id: `f_${++this.seq}`,
      name: input.name,
      steps: input.steps.map((s) => ({
        eventType: s.eventType,
        formId: s.formId ?? null,
        label: s.label ?? null,
        position: s.position,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const list = this.funnels.get(input.projectId) ?? [];
    list.push(funnel);
    this.funnels.set(input.projectId, list);
    return funnel;
  }

  async updateFunnel(
    id: string,
    input: { name?: string; steps?: { eventType: string; formId?: string; label?: string; position: number }[] },
  ): Promise<McpFunnel> {
    const funnel = await this.getFunnel(id);
    if (!funnel) throw new Error(`Funnel ${id} not found`);
    if (input.name !== undefined) funnel.name = input.name;
    if (input.steps !== undefined) {
      funnel.steps = input.steps.map((s) => ({
        eventType: s.eventType,
        formId: s.formId ?? null,
        label: s.label ?? null,
        position: s.position,
      }));
    }
    funnel.updatedAt = new Date();
    return funnel;
  }

  async deleteFunnel(id: string): Promise<void> {
    for (const [pid, list] of this.funnels) {
      this.funnels.set(
        pid,
        list.filter((f) => f.id !== id),
      );
    }
  }

  async listSavedViews(projectId: string): Promise<McpView[]> {
    return this.views.get(projectId) ?? [];
  }

  async listWebhooks(projectId: string): Promise<McpWebhook[]> {
    return this.webhooks.get(projectId) ?? [];
  }

  async createWebhook(input: { projectId: string; url: string; events: string[] }): Promise<McpWebhook> {
    const meta: McpWebhook = {
      id: `wh_${++this.seq}`,
      url: input.url,
      events: input.events,
      enabled: true,
      createdAt: new Date(),
    };
    const list = this.webhooks.get(input.projectId) ?? [];
    list.push(meta);
    this.webhooks.set(input.projectId, list);
    return meta;
  }

  async deleteWebhook(id: string): Promise<void> {
    for (const [pid, list] of this.webhooks) {
      this.webhooks.set(
        pid,
        list.filter((w) => w.id !== id),
      );
    }
  }

  async listUtmTemplates(projectId: string): Promise<McpUtmTemplate[]> {
    return this.utm.get(projectId) ?? [];
  }

  async createUtmTemplate(input: {
    projectId: string;
    name: string;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
    referral?: string | null;
  }): Promise<McpUtmTemplate> {
    const meta: McpUtmTemplate = {
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
    const list = this.utm.get(input.projectId) ?? [];
    list.push(meta);
    this.utm.set(input.projectId, list);
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
  ): Promise<McpUtmTemplate> {
    for (const list of this.utm.values()) {
      const found = list.find((t) => t.id === id);
      if (found) {
        if (input.name !== undefined) found.name = input.name;
        for (const k of ["source", "medium", "campaign", "term", "content", "referral"] as const) {
          if (input[k] !== undefined) found[k] = input[k];
        }
        return found;
      }
    }
    throw new Error(`UTM template ${id} not found`);
  }

  async deleteUtmTemplate(id: string): Promise<void> {
    for (const [pid, list] of this.utm) {
      this.utm.set(
        pid,
        list.filter((t) => t.id !== id),
      );
    }
  }

  async setProjectDomains(projectId: string, domains: string[]): Promise<string[]> {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    project.domains = domains.join(",");
    return [...domains];
  }

  async listApiKeys(projectId: string): Promise<McpApiKey[]> {
    return this.keys.get(projectId) ?? [];
  }

  async createApiKey(input: { projectId: string; name: string; keyHash: string; keyPrefix: string }): Promise<McpApiKey> {
    const meta: McpApiKey = {
      id: `ak_${++this.seq}`,
      name: input.name,
      keyPrefix: input.keyPrefix,
      createdAt: new Date(),
    };
    const list = this.keys.get(input.projectId) ?? [];
    list.push(meta);
    this.keys.set(input.projectId, list);
    return meta;
  }

  async deleteApiKey(id: string): Promise<void> {
    for (const [pid, list] of this.keys) {
      this.keys.set(
        pid,
        list.filter((k) => k.id !== id),
      );
    }
  }

  async deleteProject(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.id !== id);
    this.events.delete(id);
    this.funnels.delete(id);
    this.views.delete(id);
    this.webhooks.delete(id);
    this.utm.delete(id);
    this.keys.delete(id);
    this.memberships = this.memberships.filter((m) => m.projectId !== id);
  }

  async rotateProjectSecret(_id: string, _skHash: string): Promise<void> {
    // No secret storage in the fake.
  }

  async findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return this.users.get(email.trim().toLowerCase()) ?? null;
  }

  async listMemberships(userId: string): Promise<{ projectId: string; role: string }[]> {
    return this.memberships
      .filter((m) => m.userId === userId)
      .map((m) => ({ projectId: m.projectId, role: m.role }));
  }
}
