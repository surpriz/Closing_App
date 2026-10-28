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
import { NETWORK_CODES } from "@/lib/mailboxes/safe-host";
import type { MailboxConnector } from "@/lib/mailboxes/types";
import { textToHtml } from "@/lib/text-html";

import { outreachOrgIds } from "./flag";
import { businessHoursOf, localDayBounds, MAX_ATTEMPTS, RETRY_DELAY_MS } from "./planner";
import { threadSubject } from "./render";
import { isSuppressed } from "./suppression";

export type FollowupTransportDeps = {
  connector?: (mailbox: Parameters<typeof connectorFor>[0]) => MailboxConnector;
  /** The seller approved this draft just now: recorded on the claim, like the platform path does. */
  approvedById?: string;
  /** Already translated: why a follow-up of a finished campaign is dropped. */
  endedReason?: string;
};
export type FollowupTransportOutcome = "sent" | "failed" | "cancelled" | "ignored" | "rescheduled";

const SENDABLE = ["GENERATED", "SCHEDULED", "DRAFT"] as const;
// A mirror row that went back to the queue, or was dropped by the step sender, may be taken again
const REUSABLE = ["SCHEDULED", "CANCELLED", "FAILED"] as const;

function uniq(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

/** "<CODE>: <detail>" for a mailbox error, like Mailbox.lastError. */
function errorText(error: unknown) {
  if (isMailboxError(error)) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

const PAUSES_ENDED_BY_FOLLOWUP = ["call_moment", "deep_read"];

/** The seller's reading alert paused the enrollment; the AI follow-up is the way out. A manual or failure pause stays. */
async function resumeEnrollment(enrollmentId: string) {
  await prisma.campaignProspect.updateMany({
    where: { id: enrollmentId, status: "PAUSED", pausedReason: { in: PAUSES_ENDED_BY_FOLLOWUP } },
    data: { status: "ACTIVE", pausedReason: null, pausedAt: null },
  });
}

const STALE_MIRROR_MS = 5 * 60 * 1000;

/**
 * FOLLOWUP mirrors whose worker died (SENDING for over 5 minutes). With a Message-ID the mail may have left: a SENT
 * follow-up confirms it, otherwise it is failed rather than risk a second mail. Without one nothing left: the claim is undone.
 */
export async function reconcileFollowupMirrors(now: Date): Promise<number> {
  const stale = await prisma.campaignMessage.findMany({
    where: { kind: "FOLLOWUP", status: "SENDING", sendingAt: { lt: new Date(now.getTime() - STALE_MIRROR_MS) } },
    include: { followup: { select: { id: true, status: true, sentAt: true } } },
    take: 50,
  });
  let done = 0;
  for (const row of stale) {
    const lease = { id: row.id, status: "SENDING" as const, sendingAt: row.sendingAt };
    const f = row.followup;
    if (row.messageId && f?.status === "SENT") {
      const { count } = await prisma.campaignMessage.updateMany({
        where: lease,
        data: { status: "SENT", sentAt: f.sentAt ?? now, sendingAt: null },
      });
      if (count > 0) await resumeEnrollment(row.enrollmentId);
    } else if (row.messageId) {
      const { count } = await prisma.campaignMessage.updateMany({
        where: lease,
        data: { status: "FAILED", error: "interrupted", sendingAt: null },
      });
      if (count > 0 && f) {
        await prisma.followup.updateMany({ where: { id: f.id, status: { not: "SENT" } }, data: { status: "FAILED", error: "interrupted" } });
      }
    } else {
      const { count } = await prisma.campaignMessage.updateMany({
        where: lease,
        data: { status: "SCHEDULED", sendingAt: null },
      });
      if (count > 0 && f?.status === "SENT") {
        await prisma.followup.updateMany({
          where: { id: f.id, status: "SENT" },
          data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: now },
        });
      }
    }
    done++;
  }
  return done;
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
      campaignProspect: { include: { campaign: { select: { id: true, status: true, mailboxId: true, mailbox: true, organization: { select: { suspendedAt: true } } } } } },
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
    await prisma.campaignMessage.updateMany({
      where: { followupId: followup.id, status: { in: ["SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED", sendingAt: null },
    });
    return "cancelled" as const;
  };

  if (campaign.status === "DONE" || campaign.status === "ARCHIVED") return cancelFollowup(deps.endedReason ?? "campaign_ended");
  // Beta kill switch and suspended workspaces, like a paused campaign: due again in an hour, not on every tick
  const outOfBeta = !outreachOrgIds().includes(enrollment.organizationId) || campaign.organization.suspendedAt !== null;
  if (outOfBeta || campaign.status !== "ACTIVE") {
    await prisma.followup.updateMany({
      where: { id: followup.id, status: { in: [...SENDABLE] } },
      data: { scheduledFor: new Date(now.getTime() + HOUR_MS) },
    });
    return "ignored";
  }
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
  let attempts = 1;
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
    const existing = await prisma.campaignMessage.findUnique({ where: { dedupeKey }, select: { id: true, status: true, sentAt: true, attempts: true } });
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
    attempts = existing.attempts + 1;
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

  // Back to the queue: the follow-up stays sendable, its mirror waits SCHEDULED. `keepAttempt` when the try counts.
  const requeue = async (at: Date, keepAttempt = false) => {
    await prisma.followup.update({
      where: { id: followup.id },
      data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: at },
    });
    await prisma.campaignMessage.updateMany({
      where: { id: mirrorId },
      data: {
        status: "SCHEDULED",
        sendingAt: null,
        messageId: null,
        scheduledFor: at,
        ...(keepAttempt ? {} : { attempts: { decrement: 1 } }),
      },
    });
  };
  const fail = async (error: string, pausedReason: string | null) => {
    await prisma.followup.update({ where: { id: followup.id }, data: { status: "FAILED", sentAt: null, error } });
    await prisma.campaignMessage.updateMany({ where: { id: mirrorId }, data: { status: "FAILED", sendingAt: null, error } });
    if (pausedReason) {
      await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { status: "PAUSED", pausedReason, pausedAt: now },
      });
    }
  };
  const retryAt = new Date(now.getTime() + RETRY_DELAY_MS);

  // True from the moment the connector may have the mail: from there only the reconciliation decides
  let mayHaveLeft = false;
  try {
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
    mayHaveLeft = true;
    try {
      const connector = (deps.connector ?? connectorFor)(mailbox);
      result = await connector.send({
        to: {
          address: enrollment.email,
          name: [enrollment.firstName, enrollment.lastName].filter(Boolean).join(" ").trim() || null,
        },
        subject: finalSubject,
        // The AI body already ends with the sender's signature (system prompt rule): none is appended here
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
      // The send itself failed: nothing left
      mayHaveLeft = false;
      return await handleSendError(error);
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
    await resumeEnrollment(enrollment.id);
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
  } catch (error) {
    console.error(`[followup-transport] ${followup.id}`, error);
    // After the connector had the mail, SENT/SENDING stays for reconcileFollowupMirrors; before, the claim is undone
    if (mayHaveLeft) return "failed";
    try {
      await requeue(retryAt);
    } catch (rollback) {
      console.error(`[followup-transport] rollback ${followup.id}`, rollback);
    }
    return "failed";
  }

  async function handleSendError(error: unknown): Promise<FollowupTransportOutcome> {
    const box = mailbox!;
    const code = isMailboxError(error) ? error.code : null;
    if (isMailboxError(error) && (code === "AUTH_REVOKED" || code === "CONFIG")) {
      await prisma.mailbox.update({
        where: { id: box.id },
        data: { status: "ERROR", lastError: `${error.code}: ${error.message}`, lastErrorAt: now },
      });
      await notifyMailboxOwner(box.id, code === "AUTH_REVOKED" ? "auth_revoked" : "send_failed", error.message, now);
      await fail(errorText(error), null);
      return "failed";
    }
    if (isMailboxError(error) && (code === "QUOTA" || code === "RATE_LIMITED")) {
      const wait = error.options.retryAfterMs;
      const [slot] = nextWindowSlots(now, box.timezone, hours, 1, `${box.id}:${dedupeKey}`);
      await requeue(wait !== undefined ? new Date(now.getTime() + wait) : (slot ?? new Date(now.getTime() + DAY_MS)));
      return "rescheduled";
    }
    // The server cannot be reached: a network blip is nobody's fault, nobody is told, the try is given back
    if (isMailboxError(error) && code === "TRANSIENT" && NETWORK_CODES.test(error.options.detail ?? "")) {
      await requeue(retryAt);
      return "rescheduled";
    }
    if (code === "REJECTED") {
      await fail(errorText(error), "rejected");
      return "failed";
    }
    if (attempts < MAX_ATTEMPTS) {
      await requeue(retryAt, true);
      return "rescheduled";
    }
    await fail(errorText(error), "send_failed");
    await notifyMailboxOwner(box.id, "send_failed", errorText(error), now);
    return "failed";
  }
}
