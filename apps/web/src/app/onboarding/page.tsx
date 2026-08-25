import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const metadata: Metadata = {
  title: "Get started – Trell",
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;

  // If the user already has one or more projects AND completed onboarding,
  // there is nothing to configure — go straight to the dashboard.
  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const projects = await svc.listAccessibleProjects(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingStep: true } });
  const step = user?.onboardingStep ?? 0;

  if (projects.length > 0 && step >= 3) {
    redirect(`/${projects[0]!.slug}/analytics`);
  }

  return <OnboardingFlow initialStep={step} />;
}
