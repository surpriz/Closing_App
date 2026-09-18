import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail, textToHtml } from "@/lib/email";

import { isWhatsAppConfigured, sendWhatsApp } from "../channels/whatsapp";

type Outcome = "sent" | "failed" | "cancelled" | "skipped" | "ignored";

async function finish(id: string, status: "CANCELLED" | "SKIPPED" | "FAILED", reason: string) {
  await prisma.followup.update({
    where: { id },
    data: {
      status,
      error: reason,
      ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      ...(status === "FAILED" ? { sentAt: null } : {}),
    },
  });
}

// Re-checks everything at send time: the situation may have changed since queueing
export async function sendFollowup(followupId: string): Promise<Outcome> {
  const followup = await prisma.followup.findUnique({
    where: { id: followupId },
    include: {
      prospect: true,
      link: { include: { createdBy: { select: { email: true } } } },
    },
  });
  if (!followup || !["GENERATED", "SCHEDULED"].includes(followup.status) || !followup.body) {
    return "ignored";
  }

  const { link, prospect } = followup;

  if (link.archivedAt || !link.followupsEnabled) {
    await finish(followup.id, "CANCELLED", "Relances désactivées sur ce lien");
    return "cancelled";
  }
  if (link.dealStatus !== "OPEN") {
    await finish(followup.id, "CANCELLED", "Le prospect a déjà répondu sur la proposition");
    return "cancelled";
  }
  if (prospect.unsubscribedAt) {
    await finish(followup.id, "SKIPPED", "Prospect désinscrit");
    return "skipped";
  }
  if (followup.trigger === "ANTI_GHOSTING") {
    const openedSince = await prisma.documentView.count({
      where: { linkId: link.id, isBot: false, startedAt: { gte: followup.createdAt } },
    });
    if (openedSince > 0) {
      await finish(followup.id, "CANCELLED", "Le prospect a ouvert la proposition entre-temps");
      return "cancelled";
    }
  }

  // Claim it so two concurrent ticks can't send the same message twice
  const claimed = await prisma.followup.updateMany({
    where: { id: followup.id, status: { in: ["GENERATED", "SCHEDULED"] } },
    data: { status: "SENT", sentAt: new Date(), error: null },
  });
  if (claimed.count === 0) return "ignored";

  try {
    let providerMessageId: string | null = null;

    if (followup.channel === "EMAIL") {
      if (!isEmailConfigured()) throw new Error("Aucun service d'email configuré");
      const result = await sendEmail({
        to: prospect.email,
        from: process.env.FOLLOWUP_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM,
        // replies go to the seller who created the link
        replyTo: link.createdBy?.email ?? process.env.FOLLOWUP_EMAIL_REPLY_TO ?? undefined,
        subject: followup.subject ?? "Suite à notre proposition",
        text: followup.body,
        html: textToHtml(followup.body),
      });
      providerMessageId = result.id;
    } else {
      if (!isWhatsAppConfigured()) throw new Error("WhatsApp (Twilio) non configuré");
      if (!prospect.phoneE164 || !prospect.whatsappOptInAt) {
        throw new Error("Pas de numéro WhatsApp avec consentement");
      }
      const result = await sendWhatsApp({
        to: prospect.phoneE164,
        body: followup.body,
        templateVariables: {
          "1": prospect.name?.split(" ")[0] ?? "",
          "2": `${getPublicAppUrl()}/v/${link.slug}`,
        },
      });
      providerMessageId = result.id;
    }

    await prisma.followup.update({
      where: { id: followup.id },
      data: { providerMessageId },
    });
    return "sent";
  } catch (error) {
    await finish(followup.id, "FAILED", error instanceof Error ? error.message : "Envoi impossible");
    return "failed";
  }
}

export async function dispatchDueFollowups(now = new Date(), limit = 25) {
  const due = await prisma.followup.findMany({
    where: { status: { in: ["GENERATED", "SCHEDULED"] }, scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    select: { id: true },
    take: limit,
  });

  const counts: Record<Outcome, number> = { sent: 0, failed: 0, cancelled: 0, skipped: 0, ignored: 0 };
  for (const { id } of due) {
    counts[await sendFollowup(id)]++;
  }
  return counts;
}
