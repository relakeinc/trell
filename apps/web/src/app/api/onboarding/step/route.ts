import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Advance (or hold) the onboarding step. Body: { step: number }. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { step?: number };
  const step = body.step;
  if (typeof step !== "number" || step < 0 || step > 3) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingStep: step },
  });

  return NextResponse.json({ step });
}
