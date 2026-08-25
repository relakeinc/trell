import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { polar } from "@/lib/polar";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { productId } = (await req.json()) as { productId?: string };
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

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
