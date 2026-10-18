import type { DealCloseReason, DealStatus, MeetingOutcome } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { markDealDirty } from "../brain/analyze-deal";
import { refreshEngagementScore } from "../engagement/refresh-score";
import { cancelOpenFollowups } from "../followups/queue";

/** The seller moves a deal: dated when it closes, automated follow-ups stop once it is no longer open. */
export async function applyDealStatus(linkId: string, dealStatus: DealStatus) {
  const link = await prisma.link.update({
    where: { id: linkId },
    data: {
      dealStatus,
      closedAt: dealStatus === "OPEN" ? null : new Date(),
      // The reason belongs to a loss: a deal moved on from it starts without one
      ...(dealStatus !== "LOST" && { closedReason: null, closedNote: null }),
    },
    select: { createdBy: { select: { locale: true } } },
  });
  if (dealStatus !== "OPEN") {
    // The reason shows on the cancelled follow-ups, for the seller
    const locale = toUiLocale(link.createdBy?.locale);
    const status = getNamespaceTranslator(locale, "labels")(`dealStatus.${dealStatus}`);
    await cancelOpenFollowups(linkId, getNamespaceTranslator(locale, "server.followups")("statusChanged", { status }));
  }
  await refreshEngagementScore(linkId);
}

/** "Pourquoi perdu ?" in one click, for the "what works" stats. */
export async function setLostReason(linkId: string, reason: DealCloseReason, note: string | null) {
  await prisma.link.updateMany({
    where: { id: linkId, dealStatus: "LOST" },
    data: { closedReason: reason, closedNote: note?.trim().slice(0, 500) || null },
  });
}

/**
 * "Le rendez-vous a eu lieu ?" once its date has passed. A no-show or a cancellation puts the deal
 * back in the engine's hands: the booking no longer stops the follow-ups.
 */
export async function setMeetingOutcome(linkId: string, outcome: MeetingOutcome, userId: string | null = null) {
  const now = new Date();
  const link = await prisma.link.update({
    where: { id: linkId },
    data: {
      meetingOutcome: outcome,
      meetingOutcomeAt: now,
      ...(outcome !== "HELD" && { meetingBookedAt: null }),
    },
    select: { meetingAt: true, createdBy: { select: { locale: true } } },
  });
  // On the timeline and in the analysis: a meeting held is a contact, a no-show is a note
  const t = getNamespaceTranslator(toUiLocale(link.createdBy?.locale), "server.outcome");
  await prisma.sellerActivity.create({
    data: {
      linkId,
      userId,
      type: outcome === "HELD" ? "MEETING" : "NOTE",
      note: t(outcome),
      occurredAt: link.meetingAt && link.meetingAt < now ? link.meetingAt : now,
    },
  });
  await markDealDirty(linkId);
}
