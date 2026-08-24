import type { PrismaClient } from "@prisma/client";

export interface MembershipRow {
  projectId: string;
  userId: string;
  role: string;
  name: string;
  slug: string;
}

export interface AccessibleProject {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/** Abstraction so authorization can be tested without a real database. */
export interface MembershipRepo {
  listForUser(userId: string): Promise<MembershipRow[]>;
  findForUser(projectId: string, userId: string): Promise<MembershipRow | null>;
}

export class PrismaMembershipRepo implements MembershipRepo {
  constructor(private prisma: PrismaClient) {}

  async listForUser(userId: string): Promise<MembershipRow[]> {
    const rows = await this.prisma.projectUser.findMany({
      where: { userId },
      include: { project: { select: { id: true, name: true, slug: true } } },
    });
    return rows.map((r) => ({
      projectId: r.projectId,
      userId: r.userId,
      role: r.role,
      name: r.project.name,
      slug: r.project.slug,
    }));
  }

  async findForUser(projectId: string, userId: string): Promise<MembershipRow | null> {
    const r = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { project: { select: { id: true, name: true, slug: true } } },
    });
    return r ? { projectId: r.projectId, userId: r.userId, role: r.role, name: r.project.name, slug: r.project.slug } : null;
  }
}

/** In-memory repo for tests. */
export class MemoryMembershipRepo implements MembershipRepo {
  private rows: MembershipRow[] = [];
  add(row: MembershipRow): void {
    this.rows.push(row);
  }
  async listForUser(userId: string): Promise<MembershipRow[]> {
    return this.rows.filter((r) => r.userId === userId);
  }
  async findForUser(projectId: string, userId: string): Promise<MembershipRow | null> {
    return this.rows.find((r) => r.projectId === projectId && r.userId === userId) ?? null;
  }
}

export class ProjectAccessService {
  constructor(private repo: MembershipRepo) {}

  async listAccessibleProjects(userId: string): Promise<AccessibleProject[]> {
    const rows = await this.repo.listForUser(userId);
    return rows.map((r) => ({ id: r.projectId, name: r.name, slug: r.slug, role: r.role }));
  }

  async canAccessProject(userId: string, projectId: string): Promise<boolean> {
    const row = await this.repo.findForUser(projectId, userId);
    return row !== null;
  }

  /** Role of a user in a project, or null if not a member. */
  async roleOf(projectId: string, userId: string): Promise<string | null> {
    const row = await this.repo.findForUser(projectId, userId);
    return row?.role ?? null;
  }
}
