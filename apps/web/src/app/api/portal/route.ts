import { CustomerPortal } from "@polar-sh/nextjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
  returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/dashboard`,
  getCustomerId: async (req: NextRequest) => {
    // Extract userId from session cookie and look up Polar customer ID
    // For now, we'll need to pass it differently — see note below
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project");
    if (!projectId) return "";
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { polarCustomerId: true } });
    return project?.polarCustomerId ?? "";
  },
});
