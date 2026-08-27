import { Webhooks } from "@polar-sh/nextjs";
import { prisma } from "@/lib/prisma";

const subMeta = (payload: { data: { metadata?: unknown } }) =>
  (payload.data.metadata as Record<string, string> | null | undefined) ?? {};

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const sub = payload.data;
    const meta = subMeta(payload);
    const userId = meta.userId;

    if (!userId) return;

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "pro",
        polarCustomerId: sub.customer.id,
        subscriptionId: sub.id,
        planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
        billingPeriodStart: new Date(),
      },
    });
    // Keep the ingest API's per-project plan in sync for this account.
    await pruneOwnerMeta(userId);
  },

  onSubscriptionUpdated: async (payload) => {
    const sub = payload.data;
    const meta = subMeta(payload);
    const userId = meta.userId;

    const act = sub.status === "active" ? "pro" : "free";

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: act,
          planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
        },
      });
      await pruneOwnerMeta(userId);
      return;
    }

    // Fallback: find the account by subscription id
    const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: act,
        planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
      },
    });
    await pruneOwnerMeta(user.id);
  },

  onSubscriptionCanceled: async (payload) => {
    const sub = payload.data;
    const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: "free",
        planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
      },
    });
    await pruneOwnerMeta(user.id);
  },

  onSubscriptionRevoked: async (payload) => {
    const sub = payload.data;
    const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: "free",
        subscriptionId: null,
        planExpiresAt: null,
      },
    });
    await pruneOwnerMeta(user.id);
  },
});

/** Update every project owned by the user so the ingest API's per-project plan stays in sync. */
async function pruneOwnerMeta(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
  if (!user) return;
  await prisma.projectUser.findMany({ where: { userId, role: "owner" }, select: { projectId: true } }).then(async (members) => {
    await prisma.project.updateMany({
      where: { id: { in: members.map((m) => m.projectId) } },
      data: { plan: user.plan ?? "free", planExpiresAt: user.planExpiresAt },
    });
  });
}
