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
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";
import { textToHtml } from "@/lib/text-html";

import { outreachOrgIds } from "./flag";
import { dedupeKeyOf, replanStepMessage, scheduleStepMessage, STEP_SELECT } from "./messages";
import { businessHoursOf, localDayBounds, MAX_ATTEMPTS, READING_PAUSES, RETRY_DELAY_MS, stepSendAt } from "./planner";
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

// The reading pauses (E5) end with the AI follow-up. A manual or failure pause stays.
const PAUSES_ENDED_BY_FOLLOWUP = [...READING_PAUSES];

/**
 * The follow-up went out (E4): a reading pause ends, and in the same transaction the next fixed step is planned from
 * this send (its delay, and never sooner than minDaysBetweenFollowups). Without it the step left SCHEDULED during the
 * pause would leave right behind the follow-up, and one the sender dropped (CANCELLED) would be taken by the catch-up for
 * a failure.
 */
export async function resumeAfterFollowup(enrollmentId: string, sentAt: Date) {
  const enrollment = await prisma.campaignProspect.findUnique({
    where: { id: enrollmentId },
    include: { campaign: { select: { id: true, mailboxId: true, steps: { orderBy: { order: "asc" }, select: STEP_SELECT } } } },
  });
  if (!enrollment) return;
  const settings = await getWorkspaceSettings(enrollment.organizationId);
  const step = enrollment.campaign.steps.find((s) => s.order === enrollment.currentStep + 1);
  const mailboxId = enrollment.campaign.mailboxId;
  const resume = {
    where: { id: enrollmentId, status: "PAUSED" as const, pausedReason: { in: PAUSES_ENDED_BY_FOLLOWUP } },
    data: { status: "ACTIVE" as const, pausedReason: null, pausedAt: null },
  };
  if (!step || !mailboxId) {
    await prisma.campaignProspect.updateMany(resume);
    return;
  }
  const earliest = sentAt.getTime() + Math.max(step.delayDays, settings.minDaysBetweenFollowups) * DAY_MS;
  const at = stepSendAt(new Date(earliest), enrollment.timezone, businessHoursOf(settings), dedupeKeyOf(enrollment.id, step.id));
  const planned = { enrollment, step, campaignId: enrollment.campaign.id, mailboxId, scheduledFor: at };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.campaignProspect.updateMany(resume);
      // Only an enrollment that goes on: a stop or another pause since leaves its step where it is
      const live = await tx.campaignProspect.findUnique({ where: { id: enrollmentId }, select: { status: true } });
      if (live?.status !== "ACTIVE") return;
      if (await replanStepMessage(tx, planned)) {
        await tx.campaignProspect.updateMany({ where: { id: enrollmentId, status: "ACTIVE" }, data: { nextSendAt: at } });
      }
    });
  } catch (error) {
    // A concurrent planner created the row meanwhile (the unique violation aborts the transaction): resume and move it
    console.error(`[followup-transport] replan ${enrollmentId}`, error);
    const { count } = await prisma.campaignProspect.updateMany(resume);
    if (count > 0 && "id" in (await scheduleStepMessage(planned))) {
      await prisma.campaignProspect.updateMany({ where: { id: enrollmentId, status: "ACTIVE" }, data: { nextSendAt: at } });
    }
  }
}

// Twice the cron's 300 s period: a worker of the previous run, still sending, is never taken for a dead one
const STALE_MIRROR_MS = 10 * 60_000;

/**
 * FOLLOWUP mirrors whose worker died (SENDING for over 10 minutes). With a Message-ID the mail may have left: a SENT
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
      if (count > 0) await resumeAfterFollowup(row.enrollmentId, f.sentAt ?? now);
    } else if (row.messageId) {
      const { count } = await prisma.campaignMessage.updateMany({
        where: lease,
        data: { status: "FAILED", error: "interrupted", sendingAt: null },
      });
      if (count > 0 && f) {
        await prisma.followup.updateMany({ where: { id: f.id, status: { not: "SENT" } }, data: { status: "FAILED", error: "interrupted" } });
      }
    } else {
      // CANCELLED like a requeue: the follow-up holds the schedule, the next try takes this row back (REUSABLE)
      const { count } = await prisma.campaignMessage.updateMany({
        where: lease,
        data: { status: "CANCELLED", sendingAt: null },
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
      link: {
        include: {
          document: { select: { name: true, displayTitle: true, docType: true } },
          createdBy: { select: { locale: true } },
        },
      },
      campaignProspect: { include: { campaign: { select: { id: true, status: true, mailboxId: true, mailbox: true, organization: { select: { suspendedAt: true } } } } } },
    },
  });
  const enrollment = followup?.campaignProspect;
  if (!followup || !enrollment || !followup.body) return "ignored";
  const statuses: string[] = [...SENDABLE];
  if (!statuses.includes(followup.status)) return "ignored";

  const { campaign } = enrollment;
  const dedupeKey = `cold:${enrollment.id}:fu:${followup.id}`;
  // Reasons are stored on the follow-up and shown to the seller, like dispatch.ts does
  const t = getNamespaceTranslator(toUiLocale(followup.link.createdBy?.locale), "server.followups.dispatch");
  // Not now, later: the follow-up stays sendable. A draft the seller approved meanwhile becomes GENERATED, as
  // approveFollowup would make it, or the dispatcher would never take it again.
  const postpone = async (at: Date, error?: string) => {
    const approve =
      deps.approvedById && followup.status === "DRAFT"
        ? { status: "GENERATED" as const, ...(followup.approvedAt ? {} : { approvedAt: now, approvedById: deps.approvedById }) }
        : {};
    await prisma.followup.updateMany({
      where: { id: followup.id, status: { in: [...SENDABLE] } },
      data: { scheduledFor: at, ...(error ? { error } : {}), ...approve },
    });
  };
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

  const inAnHour = new Date(now.getTime() + HOUR_MS);
  if (campaign.status === "DONE" || campaign.status === "ARCHIVED") return cancelFollowup(deps.endedReason ?? t("campaignEnded"));
  // Beta kill switch and suspended workspaces, like a paused campaign: due again in an hour, not on every tick
  const outOfBeta = !outreachOrgIds().includes(enrollment.organizationId) || campaign.organization.suspendedAt !== null;
  if (outOfBeta || campaign.status !== "ACTIVE") {
    await postpone(inAnHour);
    return "ignored";
  }
  if (enrollment.status !== "ACTIVE" && enrollment.status !== "PAUSED") return cancelFollowup(t("enrollmentEnded"));
  // A seller's pause or a failure pause holds the follow-up too; only a reading pause is the follow-up's to end
  if (enrollment.status === "PAUSED" && !PAUSES_ENDED_BY_FOLLOWUP.includes(enrollment.pausedReason ?? "")) {
    await postpone(inAnHour);
    return "ignored";
  }
  if (await isSuppressed(enrollment.organizationId, enrollment.email)) return cancelFollowup(t("suppressed"));

  const mailbox = campaign.mailbox;
  if (!mailbox || mailbox.status !== "ACTIVE") {
    await postpone(inAnHour, t("noMailbox"));
    return "rescheduled";
  }

  const settings = await getWorkspaceSettings(mailbox.organizationId);
  const hours = businessHoursOf(settings);
  // Never right after a reading (E9), like the steps: the mail would give the tracking away
  const quietFrom = followup.link.lastActivityAt
    ? followup.link.lastActivityAt.getTime() + settings.minDelayAfterReadingHours * HOUR_MS
    : 0;
  if (quietFrom > now.getTime()) {
    await postpone(stepSendAt(new Date(quietFrom), enrollment.timezone, hours, dedupeKey));
    return "rescheduled";
  }
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

  // Back to the queue: the follow-up stays sendable and holds the schedule. Its mirror is CANCELLED, not SCHEDULED, so
  // it neither counts as a pending step nor in today's planned sends; the next try takes it back (REUSABLE).
  // `keepAttempt` when the try counts.
  const requeue = async (at: Date, keepAttempt = false) => {
    await prisma.followup.update({
      where: { id: followup.id },
      data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: at },
    });
    await prisma.campaignMessage.updateMany({
      where: { id: mirrorId },
      data: {
        status: "CANCELLED",
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
      select: { messageId: true, providerMessageId: true, mailboxId: true },
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
        replyToProviderId: sameThread && last?.mailboxId === mailbox.id ? (last.providerMessageId ?? null) : null,
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
    await resumeAfterFollowup(enrollment.id, now);
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
      // The mailbox is at fault, not the message: it waits (an hour at a time) for the seller to reconnect it
      await requeue(new Date(now.getTime() + HOUR_MS));
      return "rescheduled";
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
