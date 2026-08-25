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

  const { plan } = (await req.json()) as { plan?: string };
  const productId = plan ? PRODUCT_IDS[plan] : undefined;
  if (!productId) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  // Find the user's project to pass as metadata
  const membership = await prisma.projectUser.findFirst({
    where: { userId: session.user.id },
    include: { project: true },
  });

  const checkout = await polar.checkouts.create({
    products: [productId],
    customerEmail: session.user.email ?? undefined,
    successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/dashboard?upgraded=true`,
    metadata: {
      userId: session.user.id,
      projectId: membership?.projectId ?? "",
    },
  });

  return NextResponse.json({ url: checkout.url });
}
