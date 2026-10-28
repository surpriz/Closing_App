import type { Prisma } from "@/generated/prisma/client";
import type { CampaignMessageStatus, EnrollmentStatus } from "@/generated/prisma/enums";
import { isUniqueViolation } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";

import { templateVarsOf } from "./planner";
import { renderTemplate, threadSubject } from "./render";

export const STEP_SELECT = {
  id: true,
  order: true,
  delayDays: true,
  subject: true,
  newThread: true,
  body: true,
  carriesLink: true,
} as const;

export type StepRow = {
  id: string;
  order: number;
  delayDays: number;
  subject: string | null;
  newThread: boolean;
  body: string;
  carriesLink: boolean;
};

export type EnrollmentRow = {
  id: string;
  campaignId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  vars: unknown;
  timezone: string;
  locale: string;
  status: EnrollmentStatus;
  currentStep: number;
  threadSubject: string | null;
  firstMessageId: string | null;
  linkId: string | null;
};

export type Rendered = { subject: string; body: string; sameThread: boolean; missing: string[] };

export function dedupeKeyOf(enrollmentId: string, stepId: string) {
  return `cold:${enrollmentId}:${stepId}`;
}

/** Subject and body of a step for an enrollment: variables, then threadSubject(). `link` replaces {{link}}. */
export function renderStep(step: StepRow, enrollment: EnrollmentRow, link: string | null): Rendered {
  const vars = templateVarsOf(enrollment, link);
  const subject = step.subject === null ? null : renderTemplate(step.subject, vars);
  const body = renderTemplate(step.body, vars);
  const missing = [...(subject?.missing ?? [])];
  for (const name of body.missing) {
    if (!missing.some((m) => m.toLowerCase() === name.toLowerCase())) missing.push(name);
  }
  // {{link}} is left as is when there is no link: it must never reach a prospect
  if (!link && /\{\{\s*link\s*(?:\|[^}]*)?\}\}/i.test(`${subject?.text ?? ""}\n${body.text}`)) missing.push("link");
  const thread = threadSubject(step, enrollment.threadSubject, subject?.text ?? null);
  return { subject: thread.subject, body: body.text, sameThread: thread.sameThread, missing };
}

/**
 * Inserts the SCHEDULED message of a step for an enrollment (dedupeKey cold:<enrollmentId>:<stepId>); on a duplicate,
 * moves scheduledFor only when the row is still SCHEDULED. Returns the message id, or the status of the row that already exists and could not be moved.
 * The text stored here is a placeholder: the sender renders the step again just before sending (D1).
 */
export async function scheduleStepMessage(input: {
  enrollment: EnrollmentRow;
  step: StepRow;
  campaignId: string;
  mailboxId: string;
  scheduledFor: Date;
}): Promise<{ id: string } | { existing: CampaignMessageStatus }> {
  const dedupeKey = dedupeKeyOf(input.enrollment.id, input.step.id);
  try {
    const created = await prisma.campaignMessage.create({ data: stepMessageData(input), select: { id: true } });
    return { id: created.id };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const { count } = await prisma.campaignMessage.updateMany({
    where: { dedupeKey, status: "SCHEDULED" },
    data: { scheduledFor: input.scheduledFor },
  });
  const existing = await prisma.campaignMessage.findUnique({ where: { dedupeKey }, select: { id: true, status: true } });
  if (count > 0 && existing) return { id: existing.id };
  return { existing: existing?.status ?? "CANCELLED" };
}

type StepMessageInput = Parameters<typeof scheduleStepMessage>[0];

function stepMessageData({ enrollment, step, campaignId, mailboxId, scheduledFor }: StepMessageInput) {
  const rendered = renderStep(step, enrollment, null);
  return {
    campaignId,
    enrollmentId: enrollment.id,
    mailboxId,
    stepId: step.id,
    kind: "STEP" as const,
    status: "SCHEDULED" as const,
    scheduledFor,
    subject: rendered.subject,
    body: rendered.body,
    carriesLink: step.carriesLink,
    dedupeKey: dedupeKeyOf(enrollment.id, step.id),
  };
}

/**
 * Plans a step again at `scheduledFor`, inside the caller's transaction: a SCHEDULED row is moved, a CANCELLED one, or a
 * FAILED one that never got a Message-ID (dropped while the enrollment was paused), is re-opened from `mailboxId`, a missing one is created. Looked up first
 * rather than create-and-catch, since a unique violation would abort the transaction. False when a row is under way or
 * already sent: nothing to plan.
 */
export async function replanStepMessage(db: Prisma.TransactionClient, input: StepMessageInput): Promise<boolean> {
  const dedupeKey = dedupeKeyOf(input.enrollment.id, input.step.id);
  const existing = await db.campaignMessage.findUnique({ where: { dedupeKey }, select: { status: true, messageId: true } });
  if (!existing) {
    await db.campaignMessage.create({ data: stepMessageData(input), select: { id: true } });
    return true;
  }
  if (existing.status === "SCHEDULED") {
    const { count } = await db.campaignMessage.updateMany({
      where: { dedupeKey, status: "SCHEDULED" },
      data: { scheduledFor: input.scheduledFor },
    });
    return count > 0;
  }
  // A FAILED row with a Message-ID may have left (interrupted mid-send): never re-opened here, the seller decides
  if (existing.status === "CANCELLED" || (existing.status === "FAILED" && existing.messageId === null)) {
    const { count } = await db.campaignMessage.updateMany({
      where: { dedupeKey, OR: [{ status: "CANCELLED" }, { status: "FAILED", messageId: null }] },
      data: {
        status: "SCHEDULED",
        scheduledFor: input.scheduledFor,
        attempts: 0,
        messageId: null,
        sendingAt: null,
        error: null,
        mailboxId: input.mailboxId,
      },
    });
    return count > 0;
  }
  return false;
}
