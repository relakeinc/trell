import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { ChatWidget } from "@/components/ChatWidget";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileShell, MobileShellProvider } from "./MobileShell";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Single auth + single project list (auth() hits the DB on every call
  // with the database session strategy, so never call it twice).
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const projects = await svc.listAccessibleProjects(session.user.id);
  if (projects.length === 0) redirect("/");

  const project = projects.find((p) => p.slug === slug);
  if (!project) redirect(`/${projects[0]!.slug}/analytics`);

  return (
    <KeyboardShortcutsProvider>
      <CommandPalette />
      <MobileShellProvider>
        <MobileShell
          projectSlug={project.slug}
          projectName={project.name}
          projects={projects}
          userEmail={session.user.email ?? ""}
        >
          <div className="trell-page">
            <aside className="trell-sidebar hidden md:flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl bg-neutral-100 py-2 pr-2">
              <ProjectSidebar
                projectSlug={project.slug}
                projectName={project.name}
                projects={projects}
                userEmail={session.user.email ?? ""}
              />
            </aside>
            <div className="trell-main-frame">
              <div className="trell-main">{children}</div>
            </div>
          </div>
          <ChatWidget />
        </MobileShell>
      </MobileShellProvider>
    </KeyboardShortcutsProvider>
  );
}
