import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllProjects, getProjectBySlug } from "@/lib/project";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { CommandPalette } from "@/components/CommandPalette";
import { prisma } from "@/lib/prisma";
import { MobileShell, MobileShellProvider } from "./MobileShell";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [project, projects] = await Promise.all([
    getProjectBySlug(slug),
    getAllProjects(),
  ]);

  const projectData = await prisma.project.findUnique({
    where: { slug },
    select: { logoVariant: true },
  });

  return (
    <KeyboardShortcutsProvider>
      <CommandPalette />
      <MobileShellProvider>
        <MobileShell
          projectSlug={project.slug}
          projectName={project.name}
          projects={projects}
          userEmail={session.user.email ?? ""}
          logoVariant={projectData?.logoVariant ?? 0}
        >
          <div className="trell-page">
            <aside className="trell-sidebar hidden md:flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl bg-neutral-100 py-2 pr-2">
              <ProjectSidebar
                projectSlug={project.slug}
                projectName={project.name}
                projects={projects}
                userEmail={session.user.email ?? ""}
                logoVariant={projectData?.logoVariant ?? 0}
              />
            </aside>
            <div className="trell-main-frame">
              <div className="trell-main">{children}</div>
            </div>
          </div>
        </MobileShell>
      </MobileShellProvider>
    </KeyboardShortcutsProvider>
  );
}
