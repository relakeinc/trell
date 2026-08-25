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

  // First-time users without a project (or an incomplete onboarding) are
  // routed to the onboarding flow to configure their first project.
  if (projects.length === 0) {
    redirect("/onboarding");
  }

  // Existing users with projects but incomplete onboarding resume where they
  // left off.
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { onboardingStep: true } });
  if ((user?.onboardingStep ?? 0) < 3) {
    redirect("/onboarding");
  }

  redirect(`/${projects[0]!.slug}/analytics`);
}
