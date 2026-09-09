import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { polar } from "@/lib/polar";
import { prisma } from "@/lib/prisma";

const PRODUCT_IDS: Record<string, string> = {
  pro_monthly: process.env.POLAR_PRO_MONTHLY_ID ?? "",
  pro_yearly: process.env.POLAR_PRO_YEARLY_ID ?? "",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan, slug } = (await req.json()) as { plan?: string; slug?: string };
  const productId = plan ? PRODUCT_IDS[plan] : undefined;
  if (!productId) return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  if (!productId.trim()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  if (!slug) return NextResponse.json({ error: "missing project slug" }, { status: 400 });

  // Scope the membership to the current project — never the user's first project.
  const membership = await prisma.projectUser.findFirst({
    where: { userId: session.user.id, project: { slug } },
    include: { project: true },
  });
  if (!membership?.project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let checkout;
  try {
    checkout = await polar.checkouts.create({
    products: [productId],
    customerEmail: session.user.email ?? undefined,
    // Land back on the project's billing page (shows the Pro plan) — never a dead route.
    successUrl: membership?.project
      ? `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/${membership.project.slug}/settings/billing?upgraded=1`
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/?upgraded=1`,
    metadata: {
      userId: session.user.id,
      projectId: membership?.projectId ?? "",
    },
    });
  } catch (e) {
    console.error("[checkout] polar.checkouts.create failed", e);
    return NextResponse.json({ error: "checkout provider unavailable" }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
