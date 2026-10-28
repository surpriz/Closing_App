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
import { matchInbound, normalizeMessageId, type MatchContext, type MatchResult } from "./match";

export type InboundEffect = "reply" | "bounce" | "bounce_transient" | "bounce_policy" | "ignored" | "duplicate";

export const POLICY_BOUNCE_LIMIT = 3;
const EXCERPT_MAX = 600;
const DETAIL_MAX = 300;

type HandledMailbox = {
  id: string;
  organizationId: string;
  email: string;
  timezone: string;
};

/** What an earlier, interrupted attempt left on the event row. */
type Resume = { dsnClass: string | null; enrollmentId: string | null; matchedMessageId: string | null };

// dsnClass of a row whose effects are not finished: "pending" from the start, "retry:<kind>" once the intent is stored
const UNFINISHED = /^(pending|retry(:reply|:bounce)?)$/;

/**
 * One inbox message: recorded once (externalKey), then its effect on the enrollment it concerns.
 * The event is born "pending" and only a finished effect clears that, so a crash or a failing effect leaves a row the
 * next pass picks up again; the intent (reply or bounce, enrollment, matched message) is stored before any effect so
 * the replay does not depend on the enrollment still being live. A second failure gives up ("failed") rather than
 * blocking the mailbox: two attempts at most.
 */
export async function handleInbound(
  mailbox: HandledMailbox,
  message: InboundMessage,
  ctx: MatchContext,
  now: Date,
): Promise<InboundEffect> {
  const externalKey = `mailbox:${mailbox.id}:${message.id}`;
  // A date the database cannot store would fail the create on every pass and pin the cursor
  const receivedAt = Number.isNaN(message.date.getTime()) ? now : message.date;
  let eventId: string;
  let resume: Resume | null = null;
  try {
    const event = await prisma.mailboxInboundEvent.create({
      data: { mailboxId: mailbox.id, externalKey, kind: "IGNORED", receivedAt, dsnClass: "pending" },
      select: { id: true },
    });
    eventId = event.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.mailboxInboundEvent.findUnique({
      where: { externalKey },
      select: { id: true, kind: true, dsnClass: true, enrollmentId: true, matchedMessageId: true },
    });
    if (!existing || existing.kind !== "IGNORED" || !existing.dsnClass || !UNFINISHED.test(existing.dsnClass)) {
      return "duplicate";
    }
    eventId = existing.id;
    resume = existing;
  }

  try {
    return await apply(mailbox, message, ctx, now, eventId, resume);
  } catch (error) {
    if (!resume) throw error;
    console.error(`[mailbox-sync] giving up on ${externalKey}`, error);
    await prisma.mailboxInboundEvent.update({ where: { id: eventId }, data: { dsnClass: "failed" } }).catch(() => {});
    return "ignored";
  }
}

async function apply(
  mailbox: HandledMailbox,
  message: InboundMessage,
  ctx: MatchContext,
  now: Date,
  eventId: string,
  resume: Resume | null,
): Promise<InboundEffect> {
  // A replay trusts what the first attempt stored: matching again would miss an enrollment it already ended
  let match: MatchResult;
  let forcedTarget: Target | null = null;
  if (resume?.enrollmentId && resume.dsnClass === "retry:reply") {
    match = { kind: "reply", enrollmentId: resume.enrollmentId, via: "thread", messageId: resume.matchedMessageId };
  } else if (resume?.enrollmentId && resume.dsnClass === "retry:bounce") {
    match = {
      kind: "bounce",
      dsn: message.dsn ?? { action: "other", status: null, diagnostic: null, failedRecipient: null, originalMessageId: null },
    };
    forcedTarget = { enrollmentId: resume.enrollmentId, messageId: resume.matchedMessageId, email: null };
  } else {
    match = matchInbound(message, ctx);
  }

  if (match.kind === "own_team" || match.kind === "auto_reply" || match.kind === "unrelated") {
    await prisma.mailboxInboundEvent.update({ where: { id: eventId }, data: { dsnClass: null } });
    return "ignored";
  }

  // D14: sender, subject and a short excerpt are kept for replies and bounces only
  const base = {
    fromEmail: message.from.address,
    subject: message.subject,
    excerpt: replyExcerpt(message.textExcerpt, EXCERPT_MAX),
    messageId: message.messageId,
    inReplyTo: message.inReplyTo,
  };

  if (match.kind === "reply") {
    await prisma.mailboxInboundEvent.update({
      where: { id: eventId },
      data: { dsnClass: "retry:reply", enrollmentId: match.enrollmentId, matchedMessageId: match.messageId },
    });
    await onReply(mailbox, message, match.enrollmentId, match.messageId, now);
    await prisma.mailboxInboundEvent.update({
      where: { id: eventId },
      data: { kind: "REPLY", ...base, enrollmentId: match.enrollmentId, matchedMessageId: match.messageId, dsnClass: null },
    });
    return "reply";
  }

  const { dsn } = match;
  const dsnClass = classifyDsn(dsn);
  const target = forcedTarget ?? findTarget(dsn, ctx);
  await prisma.mailboxInboundEvent.update({
    where: { id: eventId },
    data: { dsnClass: "retry:bounce", enrollmentId: target?.enrollmentId ?? null, matchedMessageId: target?.messageId ?? null },
  });
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
    select: { linkId: true, prospectId: true },
  });
  if (!enrollment) return;

  let linkId = enrollment.linkId;
  let prospectId = enrollment.prospectId;
  if (!linkId) {
    // The reply is the moment the deal becomes worth showing: the link is created now, not owned by the campaign
    try {
      const created = await createCampaignLink(enrollmentId, { owned: false, now });
      linkId = created?.linkId ?? null;
      if (!linkId) console.error(`[mailbox-sync] ${mailbox.id} no link for reply, enrollment ${enrollmentId}`);
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
    // Only a bounce of one of our own messages says something about this mailbox; any stranger's DSN is noise
    if (!target?.messageId) return { effect: "bounce_transient", enrollmentId };
    const day = localDayKey(now, mailbox.timezone);
    const same = await prisma.mailbox.updateMany({
      where: { id: mailbox.id, policyBounceDay: day },
      data: { policyBounceCount: { increment: 1 } },
    });
    if (same.count === 0) {
      await prisma.mailbox.updateMany({
        where: { id: mailbox.id },
        data: { policyBounceDay: day, policyBounceCount: 1 },
      });
    }
    const fresh = await prisma.mailbox.findUnique({ where: { id: mailbox.id }, select: { policyBounceCount: true } });
    if ((fresh?.policyBounceCount ?? 0) >= POLICY_BOUNCE_LIMIT) {
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
  if (dsnClass === "permanent_message") {
    return { effect: target.messageId ? "bounce" : "bounce_transient", enrollmentId };
  }

  const enrollment = await prisma.campaignProspect.findUnique({
    where: { id: target.enrollmentId },
    select: { email: true, linkId: true },
  });
  const email = enrollment?.email ?? target.email;
  await stopEnrollment(target.enrollmentId, "BOUNCED", dsn.status, now);
  // A DSN found by address alone could be forged: it ends the sequence, but only one of our Message-IDs
  // is proof enough to suppress the address workspace-wide
  if (target.messageId && email) {
    await addSuppression({
      organizationId: mailbox.organizationId,
      email,
      reason: "BOUNCE",
      source: "mailbox_sync",
      detail: [dsn.status, diagnostic].filter(Boolean).join(" "),
    });
    if (enrollment?.linkId) {
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
  }
  return { effect: "bounce", enrollmentId };
}
