import { CustomerPortal } from "@polar-sh/nextjs";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
  returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/`,
  getCustomerId: async (req: NextRequest) => {
    const url = new URL(req.url);
    let projectId = url.searchParams.get("project");
    const session = await auth();
    if (!session?.user?.id) return "";
    if (!projectId) {
      // Fallback: single membership of the logged-in user (keeps old links working).
      const membership = await prisma.projectUser.findFirst({
        where: { userId: session.user.id },
        select: { projectId: true },
      });
      projectId = membership?.projectId ?? null;
    }
    if (!projectId) return "";
    // Never expose another workspace's customer portal.
    const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
    if (!(await svc.canAccessProject(session.user.id, projectId))) return "";
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { polarCustomerId: true } });
    return project?.polarCustomerId ?? "";
  },
});
