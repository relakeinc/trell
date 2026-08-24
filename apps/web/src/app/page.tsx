import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const projects = await svc.listAccessibleProjects(session.user.id);

  if (projects.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-neutral-900">
            Welcome to Trell
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Create your first project to get started.
          </p>
        </div>
      </main>
    );
  }

  redirect(`/${projects[0]!.slug}/analytics`);
}
