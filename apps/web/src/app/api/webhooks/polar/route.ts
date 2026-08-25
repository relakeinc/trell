import { Webhooks } from "@polar-sh/nextjs";
import { prisma } from "@/lib/prisma";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const sub = payload.data;
    const userId = (sub.metadata as Record<string, string>)?.userId;
    const projectId = (sub.metadata as Record<string, string>)?.projectId;

    if (!userId || !projectId) return;

    await prisma.project.update({
      where: { id: projectId },
      data: {
        plan: "pro",
        polarCustomerId: sub.customer.id,
        subscriptionId: sub.id,
        planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
      },
    });
  },

  onSubscriptionUpdated: async (payload) => {
    const sub = payload.data;
    const projectId = (sub.metadata as Record<string, string>)?.projectId;

    if (!projectId) {
      // Try to find by subscriptionId
      const project = await prisma.project.findFirst({ where: { subscriptionId: sub.id } });
      if (!project) return;

      await prisma.project.update({
        where: { id: project.id },
        data: {
          plan: sub.status === "active" ? "pro" : "free",
          planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
        },
      });
      return;
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        plan: sub.status === "active" ? "pro" : "free",
        planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
      },
    });
  },

  onSubscriptionCanceled: async (payload) => {
    const sub = payload.data;
    const project = await prisma.project.findFirst({ where: { subscriptionId: sub.id } });
    if (!project) return;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        plan: "free",
        planExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
      },
    });
  },

  onSubscriptionRevoked: async (payload) => {
    const sub = payload.data;
    const project = await prisma.project.findFirst({ where: { subscriptionId: sub.id } });
    if (!project) return;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        plan: "free",
        subscriptionId: null,
        planExpiresAt: null,
      },
    });
  },
});
