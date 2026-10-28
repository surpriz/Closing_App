import type { FollowupStatus } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { ACTIVE_WORKSPACE } from "@/lib/closing/active-workspace";
import { shareLink } from "@/lib/closing/link-url";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { toUiLocale } from "@/lib/seller-locale";
import { sendCampaignFollowup } from "@/lib/outreach/followup-transport";
import { isCampaignOwned } from "@/lib/outreach/ownership";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { isWhatsAppConfigured, sendWhatsApp } from "../channels/whatsapp";
import { replyRelayAddress } from "../replies/inbound";
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
      link: {
        include: {
          createdBy: { select: { email: true, locale: true } },
          document: { select: { name: true, displayTitle: true, docType: true } },
        },
      },
    },
  });
  const statuses: FollowupStatus[] = approvedById ? [...SENDABLE, "DRAFT"] : SENDABLE;
  if (!followup || !statuses.includes(followup.status) || !followup.body) {
    return "ignored";
  }

  const { link, prospect } = followup;
  // Reasons are stored on the follow-up and shown to the seller
  const t = getNamespaceTranslator(toUiLocale(link.createdBy?.locale), "server.followups.dispatch");

  if (link.archivedAt || !link.followupsEnabled) {
    await finish(followup.id, "CANCELLED", t("followupsOff"));
    return "cancelled";
  }
  if (link.dealStatus !== "OPEN") {
    await finish(followup.id, "CANCELLED", t("prospectReplied"));
    return "cancelled";
  }
  if (link.snoozedUntil && link.snoozedUntil > new Date()) {
    await finish(followup.id, "CANCELLED", t("paused"));
    return "cancelled";
  }
  // Even an approved one: the prospect is now in the seller's calendar
  if (link.meetingBookedAt) {
    await finish(followup.id, "CANCELLED", t("meetingBooked"));
    return "cancelled";
  }
  // The prospect answered by email: only a message the seller approved since still goes
  if (link.repliedAt && !(followup.approvedAt && followup.approvedAt > link.repliedAt) && !approvedById) {
    await finish(followup.id, "CANCELLED", t("replied"));
    return "cancelled";
  }
  if (link.quoteRequestedAt) {
    await finish(followup.id, "CANCELLED", t("quoteRequested"));
    return "cancelled";
  }
  const now = new Date();
  // Even a message the seller approved: the link it carries no longer opens
  if (isLinkExpired(link, now)) {
    await finish(followup.id, "CANCELLED", t("linkExpired"));
    return "cancelled";
  }
  if (prospect.unsubscribedAt) {
    await finish(followup.id, "SKIPPED", t("unsubscribed"));
    return "skipped";
  }
  if (prospect.bouncedAt && followup.channel === "EMAIL") {
    await finish(followup.id, "SKIPPED", t("bounced"));
    return "skipped";
  }
  // A message the seller approved stands: they saw the situation when they did
  const sellerApproved = !!followup.approvedAt || !!approvedById;
  if (followup.trigger === "EXPIRY_REMINDER") {
    // The body quotes the date it was written for
    const writtenFor = (followup.context as { expiresAt?: string } | null)?.expiresAt;
    if (writtenFor !== link.expiresAt?.toISOString()) {
      await finish(followup.id, "CANCELLED", t("deadlineChanged"));
      return "cancelled";
    }
    const left = (link.expiresAt?.getTime() ?? Infinity) - now.getTime();
    if (!sellerApproved && left < REMINDER_MIN_SEND_LEAD_MS) {
      await finish(followup.id, "CANCELLED", t("tooClose"));
      return "cancelled";
    }
  }
  if (followup.trigger === "ANTI_GHOSTING" && !sellerApproved) {
    const openedSince = await prisma.documentView.count({
      where: { linkId: link.id, isBot: false, startedAt: { gte: followup.createdAt } },
    });
    if (openedSince > 0) {
      await finish(followup.id, "CANCELLED", t("openedMeanwhile"));
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
      await finish(followup.id, "CANCELLED", t("situationChanged"));
      await prisma.link.update({ where: { id: link.id }, data: { brainDirtyAt: new Date() } });
      return "cancelled";
    }
  }

  // Claim it so two concurrent ticks can't send the same message twice
  if (followup.campaignProspectId) {
    // The campaign's mailbox sends it, in the enrollment's thread (and mirrors it as a campaign message)
    const outcome = await sendCampaignFollowup(followup.id, now, { approvedById });
    return outcome === "rescheduled" ? "ignored" : outcome;
  }
  if (isCampaignOwned(link)) {
    await finish(followup.id, "CANCELLED", t("campaign"));
    return "cancelled";
  }

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

  const share = shareLink(getPublicAppUrl(), { slug: link.slug, document: link.document, company: prospect.company });
  try {
    let providerMessageId: string | null = null;

    if (followup.channel === "EMAIL") {
      if (!isEmailConfigured()) throw new Error(t("noEmail"));
      const result = await sendProspectEmail({
        prospect,
        locale: followup.locale,
        // Prospect-facing: their language
        subject: followup.subject ?? (followup.locale.toLowerCase().startsWith("fr") ? "Suite à notre proposition" : "Following up on our proposal"),
        body: followup.body,
        replyTo: link.createdBy?.email,
        replyRelay: replyRelayAddress(followup.id),
        link: share,
      });
      providerMessageId = result.id;
    } else {
      if (!isWhatsAppConfigured()) throw new Error(t("noWhatsApp"));
      if (!prospect.phoneE164 || !prospect.whatsappOptInAt) {
        throw new Error(t("noWhatsAppConsent"));
      }
      const result = await sendWhatsApp({
        to: prospect.phoneE164,
        body: followup.body,
        templateVariables: {
          "1": prospect.name?.split(" ")[0] ?? "",
          "2": share.url,
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
    await finish(followup.id, "FAILED", error instanceof Error ? error.message : t("sendFailed"));
    return "failed";
  }
}

export async function dispatchDueFollowups(now = new Date(), limit = 25) {
  const due = await prisma.followup.findMany({
    where: { status: { in: SENDABLE }, scheduledFor: { lte: now }, link: ACTIVE_WORKSPACE },
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
