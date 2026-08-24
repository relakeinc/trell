import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaMembershipRepo, ProjectAccessService } from "@/lib/authz";
import { newApiKeys } from "@/lib/serverKeys";
import { encrypt } from "@/lib/crypto";

/**
 * Rotate the project secret key (sk). Only the project OWNER may do this.
 * The old sk stops working immediately (only the hash is stored) and the new
 * one is returned exactly once. Anyone using the old sk must update their setup.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const svc = new ProjectAccessService(new PrismaMembershipRepo(prisma));
  const role = await svc.roleOf(id, session.user.id);
  if (role !== "owner") return NextResponse.json({ error: "forbidden", message: "only the project owner can rotate keys" }, { status: 403 });

  const encKey = process.env.TRELL_ENC_KEY;
  if (!encKey) return NextResponse.json({ error: "config", message: "TRELL_ENC_KEY is not set" }, { status: 500 });

  const { sk, skHash } = newApiKeys("pk", "sk");
  await prisma.project.update({
    where: { id },
    data: { apiKeyHash: skHash, apiKeyEncrypted: encrypt(sk, encKey) },
  });

  return NextResponse.json({ rotated: true, keys: { sk } });
}
