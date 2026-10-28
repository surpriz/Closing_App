import { PlanLimitError } from "@/lib/billing/workspace-plan";
import { isUniqueViolation } from "@/lib/closing/followups/queue";
import { notifySeller } from "@/lib/closing/notify/notify";
import { recordProspectReply } from "@/lib/closing/replies/record";
import { replyExcerpt } from "@/lib/closing/replies/text";
import { prisma } from "@/lib/db";
import { pauseCampaignsOfMailbox } from "@/lib/outreach/campaigns";
import { stopEnrollment } from "@/lib/outreach/enroll";
import { createCampaignLink } from "@/lib/outreach/link";
import { releaseCampaignLink } from "@/lib/outreach/ownership";
import { addSuppression } from "@/lib/outreach/suppression";

import { localDayKey } from "../caps/allowance";
import { notifyMailboxOwner } from "../notify-owner";
import type { DsnDetails, InboundMessage } from "../types";

import { classifyDsn } from "./classify";
import { matchInbound, normalizeMessageId, type MatchContext } from "./match";

export type InboundEffect = "reply" | "bounce" | "bounce_transient" | "bounce_policy" | "ignored" | "duplicate";

export const POLICY_BOUNCE_LIMIT = 3;
const EXCERPT_MAX = 600;
const DETAIL_MAX = 300;

type HandledMailbox = {
  id: string;
  organizationId: string;
  email: string;
  timezone: string;
  policyBounceDay: string | null;
  policyBounceCount: number;
};

/**
 * One inbox message: recorded once (externalKey), then its effect on the enrollment it concerns.
 * The policy-bounce counter on `mailbox` is updated in place, so the next message of the same page sees it.
 * On failure the event is removed again so a later pass can retry the message.
 */
export async function handleInbound(
  mailbox: HandledMailbox,
  message: InboundMessage,
  ctx: MatchContext,
  now: Date,
): Promise<InboundEffect> {
  const externalKey = `mailbox:${mailbox.id}:${message.id}`;
  let event: { id: string };
  try {
    event = await prisma.mailboxInboundEvent.create({
      data: { mailboxId: mailbox.id, externalKey, kind: "IGNORED", receivedAt: message.date },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }

  try {
    return await apply(mailbox, message, ctx, now, event.id);
  } catch (error) {
    await prisma.mailboxInboundEvent.delete({ where: { id: event.id } }).catch(() => {});
    throw error;
  }
}

async function apply(
  mailbox: HandledMailbox,
  message: InboundMessage,
  ctx: MatchContext,
  now: Date,
  eventId: string,
): Promise<InboundEffect> {
  const match = matchInbound(message, ctx);
  if (match.kind === "own_team" || match.kind === "auto_reply" || match.kind === "unrelated") return "ignored";

  // D14: sender, subject and a short excerpt are kept for replies and bounces only
  const base = {
    fromEmail: message.from.address,
    subject: message.subject,
    excerpt: replyExcerpt(message.textExcerpt, EXCERPT_MAX),
    messageId: message.messageId,
    inReplyTo: message.inReplyTo,
  };

  if (match.kind === "reply") {
    await onReply(mailbox, message, match.enrollmentId, match.messageId, now);
    await prisma.mailboxInboundEvent.update({
      where: { id: eventId },
      data: { kind: "REPLY", ...base, enrollmentId: match.enrollmentId, matchedMessageId: match.messageId },
    });
    return "reply";
  }

  const { dsn } = match;
  const dsnClass = classifyDsn(dsn);
  const target = findTarget(dsn, ctx);
  const { effect, enrollmentId } = await onBounce(mailbox, dsn, dsnClass, target, now);
  await prisma.mailboxInboundEvent.update({
    where: { id: eventId },
    data: {
      kind: "BOUNCE",
      ...base,
      enrollmentId,
      matchedMessageId: target?.messageId ?? null,
      dsnStatus: dsn.status,
      dsnClass,
    },
  });
  return effect;
}

async function onReply(
  mailbox: HandledMailbox,
  message: InboundMessage,
  enrollmentId: string,
  matchedMessageId: string | null,
  now: Date,
) {
  await stopEnrollment(enrollmentId, "REPLIED", null, now);
  if (matchedMessageId) {
    await prisma.campaignMessage.updateMany({ where: { id: matchedMessageId }, data: { repliedAt: message.date } });
  }

  const enrollment = await prisma.campaignProspect.findUnique({
    where: { id: enrollmentId },
    select: { linkId: true, prospectId: true, campaign: { select: { documentId: true } } },
  });
  if (!enrollment) return;

  let linkId = enrollment.linkId;
  let prospectId = enrollment.prospectId;
  if (!linkId) {
    // The reply is the moment the deal becomes worth showing: the link is created now, not owned by the campaign
    try {
      const created = await createCampaignLink(enrollmentId, { owned: false, now });
      linkId = created?.linkId ?? null;
      prospectId = created?.prospectId ?? prospectId;
    } catch (error) {
      if (!(error instanceof PlanLimitError)) throw error;
      console.error(`[mailbox-sync] ${mailbox.id} no link for reply, plan limit`, error.reason);
    }
  }
  if (!linkId) return;

  await recordProspectReply({
    linkId,
    prospectId,
    followupId: null,
    fromEmail: message.from.address,
    fromName: message.from.name,
    excerpt: replyExcerpt(message.textExcerpt, EXCERPT_MAX),
    occurredAt: message.date,
    source: "MAILBOX",
    externalKey: `mbx:${mailbox.id}:${message.id}`.slice(0, 500),
  });
  await releaseCampaignLink(linkId);
}

type Target = { enrollmentId: string; messageId: string | null; email: string | null };

/** The mail the bounce is about: by the Message-ID we generated, else by the failed address. */
function findTarget(dsn: DsnDetails, ctx: MatchContext): Target | null {
  if (dsn.originalMessageId) {
    const sent = ctx.sentMessageIds.get(normalizeMessageId(dsn.originalMessageId));
    if (sent) return { enrollmentId: sent.enrollmentId, messageId: sent.messageId, email: null };
  }
  const failed = dsn.failedRecipient?.trim().toLowerCase();
  const byAddress = failed ? ctx.enrollments.find((e) => e.email.toLowerCase() === failed) : undefined;
  return byAddress ? { enrollmentId: byAddress.enrollmentId, messageId: null, email: byAddress.email } : null;
}

async function onBounce(
  mailbox: HandledMailbox,
  dsn: DsnDetails,
  dsnClass: ReturnType<typeof classifyDsn>,
  target: Target | null,
  now: Date,
): Promise<{ effect: InboundEffect; enrollmentId: string | null }> {
  const enrollmentId = target?.enrollmentId ?? null;
  const diagnostic = (dsn.diagnostic ?? "").slice(0, DETAIL_MAX);

  if (dsnClass === "policy") {
    // Our side (reputation, authentication), not the prospect's address: count it against the mailbox
    const day = localDayKey(now, mailbox.timezone);
    const count = mailbox.policyBounceDay === day ? mailbox.policyBounceCount + 1 : 1;
    await prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { policyBounceDay: day, policyBounceCount: count },
    });
    mailbox.policyBounceDay = day;
    mailbox.policyBounceCount = count;
    if (count >= POLICY_BOUNCE_LIMIT) {
      await pauseCampaignsOfMailbox(mailbox.id, now);
      await notifyMailboxOwner(mailbox.id, "policy_bounces", diagnostic || dsn.status, now);
    }
    return { effect: "bounce_policy", enrollmentId };
  }

  if (!target || (dsnClass !== "permanent" && dsnClass !== "permanent_message")) {
    return { effect: "bounce_transient", enrollmentId };
  }

  if (target.messageId) {
    await prisma.campaignMessage.update({
      where: { id: target.messageId },
      data: { bouncedAt: now, bounceDetail: diagnostic },
    });
  }
  if (dsnClass === "permanent_message") return { effect: "bounce", enrollmentId };

  const enrollment = await prisma.campaignProspect.findUnique({
    where: { id: target.enrollmentId },
    select: { email: true, linkId: true },
  });
  const email = enrollment?.email ?? target.email;
  await stopEnrollment(target.enrollmentId, "BOUNCED", dsn.status, now);
  if (email) {
    await addSuppression({
      organizationId: mailbox.organizationId,
      email,
      reason: "BOUNCE",
      source: "mailbox_sync",
      detail: [dsn.status, diagnostic].filter(Boolean).join(" "),
    });
  }
  if (email && enrollment?.linkId) {
    await prisma.prospect.updateMany({
      where: {
        link: { organizationId: mailbox.organizationId },
        email: { equals: email, mode: "insensitive" },
        bouncedAt: null,
      },
      data: { bouncedAt: now, bounceDetail: diagnostic },
    });
    await notifySeller({
      linkId: enrollment.linkId,
      type: "EMAIL_BOUNCED",
      dedupeKey: `email_bounced:cold:${target.enrollmentId}`,
      payload: { prospectEmail: email, detail: diagnostic },
      now,
    });
  }
  return { effect: "bounce", enrollmentId };
}
