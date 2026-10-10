import type { FollowupStatus } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

import { isWhatsAppConfigured, sendWhatsApp } from "../channels/whatsapp";
import { isLinkExpired, REMINDER_MIN_SEND_LEAD_MS } from "../expiry";
import { sendProspectEmail } from "../prospect-email";

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

const SENDABLE: FollowupStatus[] = ["GENERATED", "SCHEDULED"];

// Re-checks everything at send time: the situation may have changed since queueing.
// `approvedById` lets the seller send a DRAFT right away: approval and send in one go.
export async function sendFollowup(
  followupId: string,
  { approvedById }: { approvedById?: string } = {},
): Promise<Outcome> {
  const followup = await prisma.followup.findUnique({
    where: { id: followupId },
    include: {
      prospect: true,
      link: { include: { createdBy: { select: { email: true } } } },
    },
  });
  const statuses: FollowupStatus[] = approvedById ? [...SENDABLE, "DRAFT"] : SENDABLE;
  if (!followup || !statuses.includes(followup.status) || !followup.body) {
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
  if (link.snoozedUntil && link.snoozedUntil > new Date()) {
    await finish(followup.id, "CANCELLED", "Deal mis en pause par le vendeur");
    return "cancelled";
  }
  const now = new Date();
  // Even a message the seller approved: the link it carries no longer opens
  if (isLinkExpired(link, now)) {
    await finish(followup.id, "CANCELLED", "Lien expiré");
    return "cancelled";
  }
  if (prospect.unsubscribedAt) {
    await finish(followup.id, "SKIPPED", "Prospect désinscrit");
    return "skipped";
  }
  // A message the seller approved stands: they saw the situation when they did
  const sellerApproved = !!followup.approvedAt || !!approvedById;
  if (followup.trigger === "EXPIRY_REMINDER") {
    // The body quotes the date it was written for
    const writtenFor = (followup.context as { expiresAt?: string } | null)?.expiresAt;
    if (writtenFor !== link.expiresAt?.toISOString()) {
      await finish(followup.id, "CANCELLED", "Échéance modifiée");
      return "cancelled";
    }
    const left = (link.expiresAt?.getTime() ?? Infinity) - now.getTime();
    if (!sellerApproved && left < REMINDER_MIN_SEND_LEAD_MS) {
      await finish(followup.id, "CANCELLED", "Trop proche de l'échéance");
      return "cancelled";
    }
  }
  if (followup.trigger === "ANTI_GHOSTING" && !sellerApproved) {
    const openedSince = await prisma.documentView.count({
      where: { linkId: link.id, isBot: false, startedAt: { gte: followup.createdAt } },
    });
    if (openedSince > 0) {
      await finish(followup.id, "CANCELLED", "Le prospect a ouvert la proposition entre-temps");
      return "cancelled";
    }
  }

  // Autopilot AI follow-ups rest on one reading of the deal: if the prospect read again
  // since, that reading is stale. Drop it and let the analysis look again.
  if (followup.trigger === "AI_DECISION" && !sellerApproved && followup.insightId) {
    const insight = await prisma.dealInsight.findUnique({
      where: { id: followup.insightId },
      select: { createdAt: true },
    });
    const readSince = insight
      ? await prisma.documentView.count({
          where: { linkId: link.id, isBot: false, startedAt: { gt: insight.createdAt } },
        })
      : 0;
    if (readSince > 0) {
      await finish(followup.id, "CANCELLED", "La situation a changé depuis l'analyse");
      await prisma.link.update({ where: { id: link.id }, data: { brainDirtyAt: new Date() } });
      return "cancelled";
    }
  }

  // Claim it so two concurrent ticks can't send the same message twice
  const claimed = await prisma.followup.updateMany({
    where: { id: followup.id, status: { in: statuses } },
    data: {
      status: "SENT",
      sentAt: now,
      sentVia: "PLATFORM",
      error: null,
      ...(approvedById && !followup.approvedAt ? { approvedAt: now, approvedById } : {}),
    },
  });
  if (claimed.count === 0) return "ignored";

  try {
    let providerMessageId: string | null = null;

    if (followup.channel === "EMAIL") {
      if (!isEmailConfigured()) throw new Error("Aucun service d'email configuré");
      const result = await sendProspectEmail({
        prospect,
        locale: followup.locale,
        subject: followup.subject ?? "Suite à notre proposition",
        body: followup.body,
        replyTo: link.createdBy?.email,
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
    where: { status: { in: SENDABLE }, scheduledFor: { lte: now } },
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
