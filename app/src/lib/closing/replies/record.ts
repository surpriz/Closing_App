import type { ActivitySource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { markDealDirty } from "../brain/analyze-deal";
import { cancelOpenFollowups, isUniqueViolation } from "../followups/queue";
import { notifySeller } from "../notify/notify";

/** Deals where a reply still changes something: closed ones only keep the log line. */
const LIVE_STATUSES = ["OPEN", "CHANGE_REQUESTED"];
/** A reply the extension sees this soon after the relay logged one from the same address is that one. */
const RELAY_OVERLAP_MS = 14 * 24 * 60 * 60 * 1000;

export type ProspectReply = {
  linkId: string;
  /** The contact who wrote, when known. */
  prospectId: string | null;
  /** The follow-up answered (reply relay only). */
  followupId: string | null;
  fromEmail: string;
  fromName?: string | null;
  /** The new text of the reply, quoted history removed. */
  excerpt: string | null;
  occurredAt: Date;
  source: Extract<ActivitySource, "INBOUND" | "EXTENSION">;
  /** One email, logged once whatever path reports it again. */
  externalKey: string;
};

/**
 * The prospect answered by email. Logged on the deal like a reply the seller would have noted, and
 * the conversation becomes the seller's: automatic follow-ups stop (the seller can turn them back
 * on), the analysis takes another look and the seller is told. Returns false for an email already
 * logged.
 */
export async function recordProspectReply(reply: ProspectReply) {
  const link = await prisma.link.findUnique({
    where: { id: reply.linkId },
    select: { id: true, dealStatus: true, archivedAt: true, repliedAt: true, createdById: true },
  });
  if (!link) return false;

  // The relay already logged this answer from its copy: the extension only sees it again in Gmail
  if (reply.source === "EXTENSION") {
    const caught = await prisma.sellerActivity.findFirst({
      where: {
        linkId: link.id,
        source: "INBOUND",
        fromEmail: reply.fromEmail,
        occurredAt: { gte: new Date(reply.occurredAt.getTime() - RELAY_OVERLAP_MS) },
      },
      select: { id: true },
    });
    if (caught) return false;
  }

  try {
    await prisma.sellerActivity.create({
      data: {
        linkId: link.id,
        prospectId: reply.prospectId,
        type: "EMAIL_REPLY_RECEIVED",
        note: reply.excerpt,
        occurredAt: reply.occurredAt,
        source: reply.source,
        fromEmail: reply.fromEmail,
        externalKey: reply.externalKey,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }

  if (reply.followupId) {
    await prisma.followup.updateMany({
      where: { id: reply.followupId, repliedAt: null },
      data: { repliedAt: reply.occurredAt },
    });
  }
  if (link.archivedAt || !LIVE_STATUSES.includes(link.dealStatus)) return true;

  if (!link.repliedAt || link.repliedAt < reply.occurredAt) {
    await prisma.link.update({ where: { id: link.id }, data: { repliedAt: reply.occurredAt } });
  }
  await cancelOpenFollowups(link.id, "replied");
  await markDealDirty(link.id);
  await notifySeller({
    linkId: link.id,
    type: "PROSPECT_REPLIED",
    dedupeKey: `prospect_replied:${reply.externalKey}`,
    payload: {
      prospectEmail: reply.fromEmail,
      prospectName: reply.fromName ?? null,
      replyExcerpt: reply.excerpt?.slice(0, 600) ?? null,
      replySource: reply.source,
    },
  });
  return true;
}

/** "Reprendre les relances": the seller hands the deal back to the engine after a reply. */
export async function resumeAfterReply(linkId: string) {
  await prisma.link.update({ where: { id: linkId }, data: { repliedAt: null } });
  await markDealDirty(linkId);
}
