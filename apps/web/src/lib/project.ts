import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";

export interface ProjectData {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * Get the project for a given slug, verifying the current user has access.
 * Redirects to /signin if not authenticated, or to the first accessible
 * project if the slug doesn't match any accessible project.
 */
export async function getProjectBySlug(slug: string): Promise<ProjectData> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const projects = await svc.listAccessibleProjects(session.user.id);

  if (projects.length === 0) {
    // No projects — stay on a page that lets them create one
    redirect("/");
  }

  const project = projects.find((p) => p.slug === slug);
  if (!project) {
    // Slug doesn't match any accessible project — go to first
    redirect(`/${projects[0]!.slug}/analytics`);
  }

  return project;
}

/**
 * Get all accessible projects for the current user.
 */
export async function getAllProjects(): Promise<ProjectData[]> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  return svc.listAccessibleProjects(session.user.id);
}
