import { getPublicAppUrl } from "@/lib/app-origin";
import { DAY_MS, HOUR_MS } from "@/lib/closing/constants";
import { isUniqueViolation } from "@/lib/closing/followups/queue";
import { shareLink } from "@/lib/closing/link-url";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "@/lib/closing/unsubscribe";
import { unsubscribeFooter } from "@/lib/closing/unsubscribe/copy";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { connectorFor, generateMessageId, messageIdDomain } from "@/lib/mailboxes";
import { dailyAllowance, localDayKey } from "@/lib/mailboxes/caps/allowance";
import { reserveSend } from "@/lib/mailboxes/caps/counter";
import { nextWindowSlots } from "@/lib/mailboxes/caps/window";
import { isMailboxError } from "@/lib/mailboxes/errors";
import { notifyMailboxOwner } from "@/lib/mailboxes/notify-owner";
import type { MailboxConnector } from "@/lib/mailboxes/types";
import { textToHtml } from "@/lib/text-html";

import { businessHoursOf, localDayBounds } from "./planner";
import { threadSubject } from "./render";
import { isSuppressed } from "./suppression";

export type FollowupTransportDeps = {
  connector?: (mailbox: Parameters<typeof connectorFor>[0]) => MailboxConnector;
  /** The seller approved this draft just now: recorded on the claim, like the platform path does. */
  approvedById?: string;
};
export type FollowupTransportOutcome = "sent" | "failed" | "cancelled" | "ignored" | "rescheduled";

const SENDABLE = ["GENERATED", "SCHEDULED", "DRAFT"] as const;
// A mirror row that went back to the queue, or was dropped by the step sender, may be taken again
const REUSABLE = ["SCHEDULED", "CANCELLED", "FAILED"] as const;

function uniq(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends a campaign's AI follow-up through the seller's mailbox, in the enrollment's thread, and mirrors it as a
 * CampaignMessage of kind FOLLOWUP so the sequence reads one history. The caller has done the common re-checks.
 * The mirror is created straight in SENDING (it holds its own lease): a SCHEDULED row would be picked by the step sender.
 */
export async function sendCampaignFollowup(
  followupId: string,
  now: Date,
  deps: FollowupTransportDeps = {},
): Promise<FollowupTransportOutcome> {
  const followup = await prisma.followup.findUnique({
    where: { id: followupId },
    include: {
      prospect: { select: { company: true } },
      link: { include: { document: { select: { name: true, displayTitle: true, docType: true } } } },
      campaignProspect: { include: { campaign: { select: { id: true, status: true, mailboxId: true, mailbox: true } } } },
    },
  });
  const enrollment = followup?.campaignProspect;
  if (!followup || !enrollment || !followup.body) return "ignored";
  const statuses: string[] = [...SENDABLE];
  if (!statuses.includes(followup.status)) return "ignored";

  const { campaign } = enrollment;
  const dedupeKey = `cold:${enrollment.id}:fu:${followup.id}`;
  const cancelFollowup = async (error: string) => {
    await prisma.followup.updateMany({
      where: { id: followup.id, status: { in: [...SENDABLE] } },
      data: { status: "CANCELLED", error, cancelledAt: now },
    });
    return "cancelled" as const;
  };

  // A paused campaign keeps its follow-ups in the queue: they go out when it resumes
  if (campaign.status !== "ACTIVE") return "ignored";
  if (enrollment.status !== "ACTIVE" && enrollment.status !== "PAUSED") {
    return cancelFollowup(`enrollment_${enrollment.status.toLowerCase()}`);
  }
  if (await isSuppressed(enrollment.organizationId, enrollment.email)) return cancelFollowup("suppressed");

  const mailbox = campaign.mailbox;
  if (!mailbox || mailbox.status !== "ACTIVE") {
    await prisma.followup.updateMany({
      where: { id: followup.id, status: { in: [...SENDABLE] } },
      data: { scheduledFor: new Date(now.getTime() + HOUR_MS), error: "no_mailbox" },
    });
    return "rescheduled";
  }

  const settings = await getWorkspaceSettings(mailbox.organizationId);
  const hours = businessHoursOf(settings);
  // The slug is random and unique: the body carries the link when it holds it, whatever words precede it
  const carriesLink = followup.body.includes(followup.link.slug);

  // Mirror first: a retry or a second worker finds the same row (dedupeKey) instead of a second one
  const mirrorData = {
    campaignId: campaign.id,
    enrollmentId: enrollment.id,
    mailboxId: mailbox.id,
    kind: "FOLLOWUP" as const,
    followupId: followup.id,
    stepId: null,
    scheduledFor: now,
    dedupeKey,
  };
  const reservedAt = new Date();
  const fallbackSubject = followup.locale.toLowerCase().startsWith("fr") ? "Suite à mon message" : "Following up";
  const { subject, sameThread } = threadSubject(
    { order: 2, subject: followup.subject, newThread: false },
    enrollment.threadSubject,
    followup.subject,
  );
  const finalSubject = subject || fallbackSubject;

  let mirrorId: string;
  let created = false;
  try {
    const row = await prisma.campaignMessage.create({
      data: {
        ...mirrorData,
        status: "SENDING",
        sendingAt: reservedAt,
        attempts: 1,
        subject: finalSubject,
        body: followup.body,
        carriesLink,
      },
      select: { id: true },
    });
    mirrorId = row.id;
    created = true;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.campaignMessage.findUnique({ where: { dedupeKey }, select: { id: true, status: true, sentAt: true } });
    if (!existing) return "ignored";
    if (existing.status === "SENT") {
      // The mail left on an earlier run that died before closing the follow-up: close it, send nothing
      await prisma.followup.updateMany({
        where: { id: followup.id, status: { in: [...SENDABLE] } },
        data: { status: "SENT", sentAt: existing.sentAt ?? now, sentVia: "MAILBOX", error: null },
      });
      return "ignored";
    }
    mirrorId = existing.id;
  }

  const claimed = await prisma.followup.updateMany({
    where: { id: followup.id, status: { in: [...SENDABLE] } },
    data: {
      status: "SENT",
      sentAt: now,
      sentVia: "MAILBOX",
      error: null,
      ...(deps.approvedById && !followup.approvedAt ? { approvedAt: now, approvedById: deps.approvedById } : {}),
    },
  });
  if (claimed.count === 0) {
    if (created) await prisma.campaignMessage.updateMany({ where: { id: mirrorId, status: "SENDING" }, data: { status: "CANCELLED", sendingAt: null } });
    return "ignored";
  }

  // Back to the queue without a failure: the follow-up stays sendable, its mirror waits SCHEDULED
  const requeue = async (at: Date) => {
    await prisma.followup.update({
      where: { id: followup.id },
      data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: at },
    });
    await prisma.campaignMessage.updateMany({
      where: { id: mirrorId },
      data: { status: "SCHEDULED", sendingAt: null, messageId: null, scheduledFor: at },
    });
  };
  const fail = async (error: string, pause: boolean) => {
    await prisma.followup.update({ where: { id: followup.id }, data: { status: "FAILED", sentAt: null, error } });
    await prisma.campaignMessage.updateMany({ where: { id: mirrorId }, data: { status: "FAILED", sendingAt: null, error } });
    if (pause) {
      await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { status: "PAUSED", pausedReason: "send_failed", pausedAt: now },
      });
    }
  };

  // Mirror takes the lease (a reused row was SCHEDULED, CANCELLED or FAILED)
  if (!created) {
    const taken = await prisma.campaignMessage.updateMany({
      where: { id: mirrorId, status: { in: [...REUSABLE] } },
      data: { status: "SENDING", sendingAt: reservedAt, attempts: { increment: 1 }, subject: finalSubject, body: followup.body, carriesLink, error: null },
    });
    if (taken.count === 0) {
      await prisma.followup.update({ where: { id: followup.id }, data: { status: "GENERATED", sentAt: null, sentVia: null } });
      return "ignored";
    }
  }

  const allowance = dailyAllowance(mailbox, now, { max: getEnv().MAILBOX_DAILY_CAP_MAX });
  if (!(await reserveSend(mailbox.id, localDayKey(now, mailbox.timezone), allowance))) {
    const tomorrow = localDayBounds(now, mailbox.timezone).end;
    const [slot] = nextWindowSlots(tomorrow, mailbox.timezone, hours, 1, `${mailbox.id}:${dedupeKey}`);
    await requeue(slot ?? new Date(now.getTime() + DAY_MS));
    return "rescheduled";
  }

  const last = await prisma.campaignMessage.findFirst({
    where: { enrollmentId: enrollment.id, status: "SENT" },
    orderBy: { sentAt: "desc" },
    select: { messageId: true },
  });
  const share = shareLink(getPublicAppUrl(), { slug: followup.link.slug, document: followup.link.document, company: followup.prospect.company });
  const footer = unsubscribeFooter(unsubscribePageUrl({ kind: "enrollment", id: enrollment.id }), enrollment.locale);
  const outgoingId = generateMessageId(messageIdDomain(mailbox.email));
  await prisma.campaignMessage.updateMany({ where: { id: mirrorId }, data: { messageId: outgoingId } });

  let result;
  try {
    const connector = (deps.connector ?? connectorFor)(mailbox);
    result = await connector.send({
      to: {
        address: enrollment.email,
        name: [enrollment.firstName, enrollment.lastName].filter(Boolean).join(" ").trim() || null,
      },
      subject: finalSubject,
      text: followup.body + footer.text,
      html: textToHtml(followup.body, share) + footer.html,
      messageId: outgoingId,
      inReplyTo: sameThread ? (last?.messageId ?? null) : null,
      references: sameThread ? uniq([enrollment.firstMessageId, last?.messageId]) : [],
      headers: connector.capabilities.listUnsubscribe
        ? {
            "List-Unsubscribe": `<${unsubscribeOneClickUrl({ kind: "enrollment", id: enrollment.id })}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
      idempotencyKey: dedupeKey,
    });
  } catch (error) {
    const code = isMailboxError(error) ? error.code : null;
    if (isMailboxError(error) && (code === "AUTH_REVOKED" || code === "CONFIG")) {
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: "ERROR", lastError: `${error.code}: ${error.message}`, lastErrorAt: now },
      });
      await notifyMailboxOwner(mailbox.id, code === "AUTH_REVOKED" ? "auth_revoked" : "send_failed", error.message, now);
      await fail(errorText(error), false);
      return "failed";
    }
    if (isMailboxError(error) && (code === "QUOTA" || code === "RATE_LIMITED")) {
      const wait = error.options.retryAfterMs;
      const [slot] = nextWindowSlots(now, mailbox.timezone, hours, 1, `${mailbox.id}:${dedupeKey}`);
      await requeue(wait !== undefined ? new Date(now.getTime() + wait) : (slot ?? new Date(now.getTime() + DAY_MS)));
      return "rescheduled";
    }
    await fail(errorText(error), true);
    return "failed";
  }

  await prisma.campaignMessage.updateMany({
    where: { id: mirrorId },
    data: {
      status: "SENT",
      sentAt: now,
      sendingAt: null,
      messageId: result.messageId,
      providerMessageId: result.providerId,
      threadId: result.threadId,
      inReplyTo: sameThread ? (last?.messageId ?? null) : null,
    },
  });
  await prisma.followup.update({ where: { id: followup.id }, data: { providerMessageId: result.providerId } });
  // The seller's paused enrollment resumes: the AI follow-up was the way out of the pause (currentStep unchanged)
  await prisma.campaignProspect.updateMany({
    where: { id: enrollment.id, status: "PAUSED" },
    data: { status: "ACTIVE", pausedReason: null, pausedAt: null },
  });
  if (!enrollment.threadSubject || !enrollment.firstMessageId) {
    await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id },
      data: {
        ...(enrollment.threadSubject ? {} : { threadSubject: finalSubject }),
        ...(enrollment.firstMessageId ? {} : { firstMessageId: result.messageId }),
        ...(enrollment.providerThreadId ? {} : { providerThreadId: result.threadId }),
      },
    });
  }
  return "sent";
}
