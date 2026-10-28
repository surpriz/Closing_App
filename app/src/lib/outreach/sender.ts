import type { Mailbox } from "@/generated/prisma/client";
import { PlanLimitError } from "@/lib/billing/workspace-plan";
import { DAY_MS, HOUR_MS } from "@/lib/closing/constants";
import type { BusinessHours } from "@/lib/closing/scheduling/business-hours";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "@/lib/closing/unsubscribe";
import { unsubscribeFooter } from "@/lib/closing/unsubscribe/copy";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { connectorFor, generateMessageId, messageIdDomain } from "@/lib/mailboxes";
import { dailyAllowance, localDayKey, remainingToday } from "@/lib/mailboxes/caps/allowance";
import { reserveSend } from "@/lib/mailboxes/caps/counter";
import { nextWindowSlots } from "@/lib/mailboxes/caps/window";
import { isMailboxError, type MailboxErrorCode } from "@/lib/mailboxes/errors";
import { notifyMailboxOwner } from "@/lib/mailboxes/notify-owner";
import { NETWORK_CODES } from "@/lib/mailboxes/safe-host";
import type { MailboxConnector } from "@/lib/mailboxes/types";
import { textToHtml } from "@/lib/text-html";

import { stopEnrollment } from "./enroll";
import { campaignMessageUrl, createCampaignLink, type CampaignLink } from "./link";
import { dedupeKeyOf, renderStep, scheduleStepMessage, type EnrollmentRow, type StepRow } from "./messages";
import {
  businessHoursOf,
  inBusinessHours,
  localDayBounds,
  MAX_ATTEMPTS,
  MAX_SENDS_PER_TICK_PER_MAILBOX,
  nextStepFor,
  READING_PAUSES,
  RETRY_DELAY_MS,
  retryAt,
  STALE_LEASE_MS,
  stepSendAt,
} from "./planner";
import { budgetLeft, organizationWhere, type OutreachScope } from "./scope";
import { isSuppressed } from "./suppression";

export type SendDeps = { connector?: (mailbox: Parameters<typeof connectorFor>[0]) => MailboxConnector; now?: Date };
type Totals = { sent: number; rescheduled: number; failed: number; cancelled: number };
type Outcome = "next" | "stop";

/** A tick stops taking new messages after this long (or sooner, at the scope's deadline), so its leases stay well under STALE_LEASE_MS. */
export const SEND_BUDGET_MS = 120_000;

const LIVE_ENROLLMENT = ["QUEUED", "ACTIVE", "PAUSED"] as const;

/**
 * SENDING rows whose worker died. A row that never got its Message-ID did not reach the connector: it is tried
 * again while attempts remain. A row that has one may have left (SMTP ignores the idempotency key): at-most-once,
 * it is failed and the enrollment waits for the seller rather than risk a second mail, whatever the enrollment's status.
 * A row without one whose enrollment ended meanwhile (reply, stop, unsubscribe) never left: it is cancelled first, since
 * requeuing it would only keep its campaign from being DONE.
 */
export async function expireStaleLeases(
  now: Date,
  scope: OutreachScope = {},
): Promise<{ requeued: number; failed: number; cancelled: number }> {
  const org = organizationWhere(scope);
  const stale = {
    status: "SENDING" as const,
    // A follow-up mirror is the follow-up transport's: it is never requeued or cancelled here
    kind: "STEP" as const,
    sendingAt: { lt: new Date(now.getTime() - STALE_LEASE_MS) },
    ...(org.organizationId ? { campaign: org } : {}),
  };
  const cancelled = await prisma.campaignMessage.updateMany({
    where: { ...stale, messageId: null, enrollment: { status: { notIn: [...LIVE_ENROLLMENT] } } },
    data: { status: "CANCELLED", error: "interrupted", sendingAt: null },
  });
  const failStale = async (extra: object) => {
    const rows = await prisma.campaignMessage.findMany({ where: { ...stale, ...extra }, select: { id: true, enrollmentId: true } });
    let failed = 0;
    for (const row of rows) {
      // Per row, guarded: only an enrollment whose message really transitioned is paused
      const { count } = await prisma.campaignMessage.updateMany({
        where: { ...stale, id: row.id },
        data: { status: "FAILED", error: "interrupted", sendingAt: null },
      });
      if (count === 0) continue;
      failed++;
      // A failed message left on an ACTIVE enrollment would be picked again by the catch-up forever
      await prisma.campaignProspect.updateMany({
        where: { id: row.enrollmentId, status: "ACTIVE" },
        data: { status: "PAUSED", pausedReason: "interrupted", pausedAt: now },
      });
    }
    return failed;
  };
  const started = await failStale({ messageId: { not: null } });
  const requeued = await prisma.campaignMessage.updateMany({
    where: { ...stale, messageId: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: "SCHEDULED", sendingAt: null },
  });
  const exhausted = await failStale({ messageId: null, attempts: { gte: MAX_ATTEMPTS } });
  return { requeued: requeued.count, failed: started + exhausted, cancelled: cancelled.count };
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function recipientName(e: { firstName: string | null; lastName: string | null }) {
  return [e.firstName, e.lastName].filter(Boolean).join(" ").trim() || null;
}

function uniq(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

/** The lease: only the worker that reserved the row, at that very instant, may move it on. */
const leased = (id: string, reservedAt: Date) => ({ id, status: "SENDING" as const, sendingAt: reservedAt });

/** A message that goes back to the queue without having failed: the attempt taken by the reservation is given back. */
async function requeue(id: string, reservedAt: Date, scheduledFor?: Date, mailboxId?: string) {
  const { count } = await prisma.campaignMessage.updateMany({
    where: leased(id, reservedAt),
    data: {
      status: "SCHEDULED",
      sendingAt: null,
      messageId: null,
      attempts: { decrement: 1 },
      ...(scheduledFor ? { scheduledFor } : {}),
      ...(mailboxId ? { mailboxId } : {}),
    },
  });
  return count > 0;
}

async function cancel(id: string, reservedAt: Date, error?: string) {
  const { count } = await prisma.campaignMessage.updateMany({
    where: leased(id, reservedAt),
    data: { status: "CANCELLED", sendingAt: null, ...(error ? { error } : {}) },
  });
  return count > 0;
}

/** The message is dropped and the enrollment waits for the seller. Nothing happens if the lease was lost. */
async function failAndPause(
  messageId: string,
  reservedAt: Date,
  enrollmentId: string,
  error: string,
  reason: string,
  now: Date,
) {
  const { count } = await prisma.campaignMessage.updateMany({
    where: leased(messageId, reservedAt),
    data: { status: "FAILED", error, sendingAt: null },
  });
  if (count === 0) return false;
  await prisma.campaignProspect.updateMany({
    where: { id: enrollmentId, status: "ACTIVE" },
    data: { status: "PAUSED", pausedReason: reason, pausedAt: now },
  });
  return true;
}

/** Sends what is due, mailbox by mailbox: reserve, re-check, count against the cap, send, record (D1, D4, D10). */
export async function sendDueMessages(
  now: Date,
  scope: OutreachScope = {},
  deps: SendDeps = {},
): Promise<Totals> {
  const totals: Totals = { sent: 0, rescheduled: 0, failed: 0, cancelled: 0 };
  const startedAt = Date.now();
  const budgetMs = budgetLeft(SEND_BUDGET_MS, scope.deadline);
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: "ACTIVE",
      ...organizationWhere(scope),
      organization: { suspendedAt: null },
      messages: { some: { kind: "STEP", status: "SCHEDULED", scheduledFor: { lte: now } } },
    },
  });

  for (const mailbox of mailboxes) {
    const max = getEnv().MAILBOX_DAILY_CAP_MAX;
    const take = Math.min(remainingToday(mailbox, now, { max }), MAX_SENDS_PER_TICK_PER_MAILBOX);
    if (take <= 0) continue;

    const settings = await getWorkspaceSettings(mailbox.organizationId);
    const hours = businessHoursOf(settings);
    const signature = mailbox.signature ?? settings.senderSignature ?? null;
    const readDelayHours = settings.minDelayAfterReadingHours;
    const candidates = await prisma.campaignMessage.findMany({
      where: {
        mailboxId: mailbox.id,
        kind: "STEP",
        status: "SCHEDULED",
        scheduledFor: { lte: now },
        campaign: { status: "ACTIVE" },
        enrollment: { status: "ACTIVE" },
      },
      orderBy: { scheduledFor: "asc" },
      take,
    });

    let connector: MailboxConnector | null = null;
    const connectorOf = () => (connector ??= (deps.connector ?? connectorFor)(mailbox));

    for (const candidate of candidates) {
      if (Date.now() - startedAt >= budgetMs) return totals;
      // Real clock, not the tick's `now`: the lease must tell two overlapping ticks apart
      const reservedAt = new Date();
      // Still due: a row pushed to later since the candidates were read (E9, cap, retry) is not taken from a stale list
      const reserved = await prisma.campaignMessage.updateMany({
        where: { id: candidate.id, status: "SCHEDULED", scheduledFor: { lte: now } },
        data: { status: "SENDING", sendingAt: reservedAt, attempts: { increment: 1 } },
      });
      if (reserved.count === 0) continue;
      const state = { marked: false };
      const ctx = { messageId: candidate.id, reservedAt, mailbox, hours, signature, readDelayHours, now, totals, connectorOf, state };
      try {
        if ((await sendOne(ctx)) === "stop") break;
      } catch (error) {
        console.error(`[outreach-sender] ${candidate.id}`, error);
        // Once the Message-ID is written the mail may have left: the row stays SENDING and expires as interrupted
        if (state.marked) continue;
        const again = retryAt(now, candidate.attempts + 1);
        if (again) {
          await prisma.campaignMessage.updateMany({
            where: leased(candidate.id, reservedAt),
            data: { status: "SCHEDULED", sendingAt: null, messageId: null, scheduledFor: again },
          });
          totals.rescheduled++;
        } else {
          // Paused with it: an ACTIVE enrollment left with a FAILED message (even its first) would never move on
          await failAndPause(candidate.id, reservedAt, candidate.enrollmentId, errorText(error), "send_failed", now);
          totals.failed++;
        }
      }
    }
  }
  return totals;
}

async function sendOne(ctx: {
  messageId: string;
  reservedAt: Date;
  mailbox: Mailbox;
  hours: BusinessHours;
  signature: string | null;
  readDelayHours: number;
  now: Date;
  totals: Totals;
  connectorOf: () => MailboxConnector;
  state: { marked: boolean };
}): Promise<Outcome> {
  const { messageId, reservedAt, mailbox, hours, signature, readDelayHours, now, totals } = ctx;

  const message = await prisma.campaignMessage.findUnique({
    where: { id: messageId },
    include: {
      enrollment: true,
      campaign: { select: { status: true, documentId: true, createdById: true, mailboxId: true } },
    },
  });
  if (!message || message.status !== "SENDING") return "next";
  const { enrollment, campaign } = message;
  const dedupeKey = message.dedupeKey;

  // The campaign moved to another mailbox after this row was planned: it follows, and leaves this mailbox's batch
  if (campaign.mailboxId !== mailbox.id) {
    if (campaign.mailboxId) await requeue(message.id, reservedAt, undefined, campaign.mailboxId);
    else {
      await cancel(message.id, reservedAt, "no_mailbox");
      totals.cancelled++;
    }
    return "next";
  }

  const steps = await prisma.campaignStep.findMany({ where: { campaignId: message.campaignId }, orderBy: { order: "asc" } });
  const step = steps.find((s) => s.id === message.stepId);
  if (!step) {
    await cancel(message.id, reservedAt, "step_removed");
    totals.cancelled++;
    return "next";
  }
  const last = await prisma.campaignMessage.findFirst({
    where: { enrollmentId: enrollment.id, status: "SENT" },
    orderBy: { sentAt: "desc" },
    select: { messageId: true, providerMessageId: true, mailboxId: true, sentAt: true },
  });

  // Re-checks, in this order: the situation may have changed since the message was planned
  // A reading pause ends with its AI follow-up, which plans this step again from its own send: the row waits, it is not
  // dropped (a CANCELLED step would read as a failure to the catch-up)
  if (enrollment.status === "PAUSED" && READING_PAUSES.includes(enrollment.pausedReason ?? "")) {
    await requeue(message.id, reservedAt);
    totals.rescheduled++;
    return "next";
  }
  if (enrollment.status !== "ACTIVE") {
    await cancel(message.id, reservedAt);
    totals.cancelled++;
    return "next";
  }
  const live = await prisma.mailbox.findUnique({ where: { id: mailbox.id }, select: { status: true } });
  if (campaign.status !== "ACTIVE" || live?.status !== "ACTIVE") {
    await requeue(message.id, reservedAt);
    return "next";
  }
  if (await isSuppressed(enrollment.organizationId, enrollment.email)) {
    await stopEnrollment(enrollment.id, "SUPPRESSED", "suppressed", now);
    // stopEnrollment leaves SENDING rows to their lease: this one is ours, so it is cancelled here
    await cancel(message.id, reservedAt, "suppressed");
    totals.cancelled++;
    return "next";
  }
  if (!inBusinessHours(now, enrollment.timezone, hours)) {
    await requeue(message.id, reservedAt, stepSendAt(now, enrollment.timezone, hours, dedupeKey));
    totals.rescheduled++;
    return "next";
  }

  // Never right after a reading: the mail would give the tracking away (E9)
  if (enrollment.linkId) {
    const read = await prisma.link.findUnique({ where: { id: enrollment.linkId }, select: { lastActivityAt: true } });
    const quietFrom = read?.lastActivityAt ? read.lastActivityAt.getTime() + readDelayHours * HOUR_MS : 0;
    if (quietFrom > now.getTime()) {
      await requeue(message.id, reservedAt, stepSendAt(new Date(quietFrom), enrollment.timezone, hours, dedupeKey));
      totals.rescheduled++;
      return "next";
    }
  }

  // Link: created with the first message that carries it, then reused by every retry
  let link: CampaignLink | null = null;
  if (step.carriesLink) {
    try {
      link = await createCampaignLink(enrollment.id, { owned: true, now });
    } catch (error) {
      if (!(error instanceof PlanLimitError)) return handleFailure(error, ctx, message, enrollment.id);
      await failAndPause(message.id, reservedAt, enrollment.id, "plan_limit", "plan_limit", now);
      totals.failed++;
      return "next";
    }
    if (!link) {
      await failAndPause(message.id, reservedAt, enrollment.id, "document_missing", "document_missing", now);
      totals.failed++;
      return "next";
    }
  }

  // ?c= credits the opening to this very message
  const messageUrl = link ? campaignMessageUrl(link.url, message.id) : null;
  const rendered = renderStep(step, enrollment, messageUrl);
  if (rendered.missing.length > 0) {
    // Not a dead end: the seller can add a fallback to the step and resume, which re-opens this cancelled message
    const reason = `missing_variable:${rendered.missing[0]}`;
    await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id, status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: reason, pausedAt: now },
    });
    await cancel(message.id, reservedAt, reason);
    totals.cancelled++;
    return "next";
  }
  const visible = signature ? `${rendered.body}\n\n${signature}` : rendered.body;
  const footer = unsubscribeFooter(unsubscribePageUrl({ kind: "enrollment", id: enrollment.id }), enrollment.locale);
  const text = visible + footer.text;
  const html = textToHtml(visible, link && messageUrl ? { url: messageUrl, title: link.title } : null) + footer.html;

  // The cap is counted just before the send: a mailbox never goes over its day, whatever the other workers do
  const allowance = dailyAllowance(mailbox, now, { max: getEnv().MAILBOX_DAILY_CAP_MAX });
  if (!(await reserveSend(mailbox.id, localDayKey(now, mailbox.timezone), allowance))) {
    const tomorrow = localDayBounds(now, mailbox.timezone).end;
    const [slot] = nextWindowSlots(tomorrow, mailbox.timezone, hours, 1, `${mailbox.id}:${dedupeKey}`);
    await requeue(message.id, reservedAt, slot ?? new Date(now.getTime() + DAY_MS));
    totals.rescheduled++;
    return "stop";
  }

  // Written before the send and guarded by the lease: a row with a Message-ID may have left (see expireStaleLeases).
  // The statuses are re-read here too, which narrows (but cannot close) the window for a stop during the send.
  const outgoingId = generateMessageId(messageIdDomain(mailbox.email));
  const marked = await prisma.campaignMessage.updateMany({
    where: { ...leased(message.id, reservedAt), enrollment: { status: "ACTIVE" }, campaign: { status: "ACTIVE" } },
    data: { messageId: outgoingId },
  });
  if (marked.count === 0) {
    // Not sent, and nothing may leave now: the row must not sit SENDING until its lease expires
    const fresh = await prisma.campaignProspect.findUnique({ where: { id: enrollment.id }, select: { status: true } });
    if (fresh && (LIVE_ENROLLMENT as readonly string[]).includes(fresh.status)) await requeue(message.id, reservedAt);
    else {
      await cancel(message.id, reservedAt);
      totals.cancelled++;
    }
    return "next";
  }
  ctx.state.marked = true;

  let result;
  try {
    const connector = ctx.connectorOf();
    result = await connector.send({
      to: { address: enrollment.email, name: recipientName(enrollment) },
      subject: rendered.subject,
      text,
      html,
      messageId: outgoingId,
      inReplyTo: rendered.sameThread ? (last?.messageId ?? null) : null,
      references: rendered.sameThread ? uniq([enrollment.firstMessageId, last?.messageId]) : [],
      // API connectors thread through the provider id, not the headers; an id from another mailbox means nothing here
      replyToProviderId: rendered.sameThread && last?.mailboxId === mailbox.id ? (last.providerMessageId ?? null) : null,
      headers: connector.capabilities.listUnsubscribe
        ? {
            "List-Unsubscribe": `<${unsubscribeOneClickUrl({ kind: "enrollment", id: enrollment.id })}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
      idempotencyKey: dedupeKey,
    });
  } catch (error) {
    // The send itself failed: unless the connector says the mail may have left, the marker is cleared with the requeue
    return handleFailure(error, ctx, message, enrollment.id);
  }

  // A step that opens a new thread becomes the thread start: later steps reference it, not the previous thread
  const progress = rendered.sameThread
    ? {
        currentStep: step.order,
        threadSubject: enrollment.threadSubject,
        firstMessageId: enrollment.firstMessageId ?? result.messageId,
        providerThreadId: enrollment.providerThreadId ?? result.threadId,
      }
    : { currentStep: step.order, threadSubject: rendered.subject, firstMessageId: result.messageId, providerThreadId: result.threadId };
  // One transaction: a message that is SENT always moves its enrollment on, so the catch-up never plans it again
  const recorded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.campaignMessage.updateMany({
      where: leased(message.id, reservedAt),
      data: {
        status: "SENT",
        sentAt: now,
        sendingAt: null,
        messageId: result.messageId,
        providerMessageId: result.providerId,
        threadId: result.threadId,
        subject: rendered.subject,
        body: visible,
        inReplyTo: rendered.sameThread ? (last?.messageId ?? null) : null,
        carriesLink: step.carriesLink,
      },
    });
    if (count === 0) return false;
    await tx.campaignProspect.update({ where: { id: enrollment.id }, data: progress });
    return true;
  });
  if (!recorded) {
    console.error(`[outreach-sender] ${message.id} lease lost after send`);
    return "next";
  }
  totals.sent++;

  // The next step is planned right away; the end of the sequence is noticed by planEnrollments
  const action = nextStepFor({
    enrollment: { status: "ACTIVE", currentStep: step.order, lastSentAt: now },
    steps,
    now,
  });
  if (action.kind === "send_step") {
    const nextStep: StepRow = steps.find((s) => s.id === action.step.id)!;
    const at = stepSendAt(action.earliest, enrollment.timezone, hours, dedupeKeyOf(enrollment.id, nextStep.id));
    // Only while the enrollment is still ACTIVE: a reply or a pause during the send must not leave a message behind
    const still = await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id, status: "ACTIVE" },
      data: { nextSendAt: at },
    });
    // Read again: the campaign may have moved to another mailbox during the send, the next step goes from there
    const current = await prisma.campaign.findUnique({ where: { id: message.campaignId }, select: { mailboxId: true } });
    if (still.count === 1 && current?.mailboxId) {
      await scheduleStepMessage({
        enrollment: { ...enrollment, ...progress },
        step: nextStep,
        campaignId: message.campaignId,
        mailboxId: current.mailboxId,
        scheduledFor: at,
      });
    }
  } else {
    await prisma.campaignProspect.updateMany({ where: { id: enrollment.id, status: "ACTIVE" }, data: { nextSendAt: null } });
  }
  return "next";
}

function isNetworkFailure(error: unknown) {
  if (!isMailboxError(error)) return false;
  const detail = error.options.detail ?? "";
  return NETWORK_CODES.test(detail);
}

/** D4: what a failed send does to the message, the enrollment and the mailbox. */
async function handleFailure(
  error: unknown,
  ctx: { mailbox: Mailbox; reservedAt: Date; hours: BusinessHours; now: Date; totals: Totals },
  message: { id: string; attempts: number; dedupeKey: string },
  enrollmentId: string,
): Promise<Outcome> {
  const { mailbox, reservedAt, hours, now, totals } = ctx;
  const code: MailboxErrorCode | null = isMailboxError(error) ? error.code : null;

  // The provider had taken the mail when it failed: it may have left. At-most-once, as for a stale lease: the row keeps
  // its Message-ID and the enrollment waits for the seller. The batch stops, the next send would likely fail the same way
  if (isMailboxError(error) && error.maybeSent) {
    if (await failAndPause(message.id, reservedAt, enrollmentId, "interrupted", "interrupted", now)) totals.failed++;
    return "stop";
  }

  if (isMailboxError(error) && (code === "AUTH_REVOKED" || code === "CONFIG")) {
    await prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { status: "ERROR", lastError: `${error.code}: ${error.message}`, lastErrorAt: now },
    });
    await requeue(message.id, reservedAt);
    // A bad setting is not a revoked login: the owner is told the sending failed, the UI shows the code from lastError
    await notifyMailboxOwner(mailbox.id, code === "AUTH_REVOKED" ? "auth_revoked" : "send_failed", error.message, now);
    return "stop";
  }

  if (isMailboxError(error) && (code === "QUOTA" || code === "RATE_LIMITED")) {
    const wait = error.options.retryAfterMs;
    const [slot] = nextWindowSlots(now, mailbox.timezone, hours, 1, `${mailbox.id}:${message.dedupeKey}`);
    await requeue(message.id, reservedAt, wait !== undefined ? new Date(now.getTime() + wait) : (slot ?? new Date(now.getTime() + DAY_MS)));
    totals.rescheduled++;
    return "stop";
  }

  // The server cannot be reached: every other message of this mailbox would fail the same way, so the batch stops here.
  // The row is given its attempt back, nobody is told: a network blip is not the seller's problem
  if (code === "TRANSIENT" && isNetworkFailure(error)) {
    await requeue(message.id, reservedAt, new Date(now.getTime() + RETRY_DELAY_MS));
    totals.rescheduled++;
    return "stop";
  }

  if (code === "REJECTED") {
    await failAndPause(message.id, reservedAt, enrollmentId, errorText(error), "rejected", now);
    totals.failed++;
    return "next";
  }

  const again = retryAt(now, message.attempts);
  if (again) {
    await prisma.campaignMessage.updateMany({
      where: leased(message.id, reservedAt),
      data: { status: "SCHEDULED", sendingAt: null, messageId: null, scheduledFor: again },
    });
    totals.rescheduled++;
    return "next";
  }
  if (await failAndPause(message.id, reservedAt, enrollmentId, errorText(error), "send_failed", now)) {
    await notifyMailboxOwner(mailbox.id, "send_failed", errorText(error), now);
    totals.failed++;
  }
  return "next";
}

const SAMPLE = { firstName: "Marie", lastName: "Durand", company: "Acme", title: "Directrice" };

/** "Send me a test" (D11): from the campaign's mailbox to the seller, counted in the cap, never stored. */
export async function sendTestMessage(
  input: { organizationId: string; campaignId: string; stepOrder: number; to: string; now?: Date },
  deps: SendDeps = {},
): Promise<{ ok: true } | { ok: false; code: "not_found" | "no_mailbox" | "cap" | MailboxErrorCode }> {
  const now = input.now ?? deps.now ?? new Date();
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId },
    include: {
      mailbox: true,
      steps: { orderBy: { order: "asc" } },
      enrollments: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (!campaign) return { ok: false, code: "not_found" };
  const mailbox = campaign.mailbox;
  if (!mailbox || mailbox.status !== "ACTIVE") return { ok: false, code: "no_mailbox" };
  const step = campaign.steps.find((s) => s.order === input.stepOrder);
  if (!step) return { ok: false, code: "not_found" };

  const first = campaign.enrollments[0];
  const base: EnrollmentRow = {
    id: "test",
    campaignId: campaign.id,
    email: input.to,
    ...SAMPLE,
    vars: null,
    timezone: mailbox.timezone,
    locale: campaign.locale,
    status: "ACTIVE",
    currentStep: 0,
    threadSubject: null,
    firstMessageId: null,
    linkId: null,
  };
  const sample: EnrollmentRow = first ? { ...first, threadSubject: null, firstMessageId: null, linkId: null } : base;
  // No real link is created for a test: a placeholder in the campaign's language stands in for it
  const placeholder = campaign.locale === "fr" ? "[lien Clozer]" : "[Clozer link]";
  // A later step has no subject of its own: it borrows the first step's, as it would in the thread
  const opener = campaign.steps[0] && campaign.steps[0].id !== step.id ? renderStep(campaign.steps[0], sample, placeholder) : null;
  const rendered = renderStep(step, { ...sample, threadSubject: opener?.subject ?? null }, placeholder);

  const max = getEnv().MAILBOX_DAILY_CAP_MAX;
  if (!(await reserveSend(mailbox.id, localDayKey(now, mailbox.timezone), dailyAllowance(mailbox, now, { max })))) {
    return { ok: false, code: "cap" };
  }

  const settings = await getWorkspaceSettings(mailbox.organizationId);
  const signature = mailbox.signature ?? settings.senderSignature ?? null;
  const visible = signature ? `${rendered.body}\n\n${signature}` : rendered.body;
  try {
    await (deps.connector ?? connectorFor)(mailbox).send({
      to: { address: input.to },
      subject: `[Test] ${rendered.subject}`,
      text: visible,
      html: textToHtml(visible),
      messageId: generateMessageId(messageIdDomain(mailbox.email)),
      idempotencyKey: `test:${campaign.id}:${step.id}:${now.getTime()}`,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, code: isMailboxError(error) ? error.code : "TRANSIENT" };
  }
}
