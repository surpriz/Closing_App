import type { EnrollmentStatus } from "@/generated/prisma/enums";
import { isUniqueViolation } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";

import { templateVarsOf } from "./planner";
import { renderTemplate, threadSubject } from "./render";

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
 * moves scheduledFor only when the row is still SCHEDULED. Returns the message id, or null when it already left.
 * The text stored here is a placeholder: the sender renders the step again just before sending (D1).
 */
export async function scheduleStepMessage(input: {
  enrollment: EnrollmentRow;
  step: StepRow;
  campaignId: string;
  mailboxId: string;
  scheduledFor: Date;
}): Promise<string | null> {
  const { enrollment, step, campaignId, mailboxId, scheduledFor } = input;
  const dedupeKey = dedupeKeyOf(enrollment.id, step.id);
  const rendered = renderStep(step, enrollment, null);
  try {
    const created = await prisma.campaignMessage.create({
      data: {
        campaignId,
        enrollmentId: enrollment.id,
        mailboxId,
        stepId: step.id,
        kind: "STEP",
        status: "SCHEDULED",
        scheduledFor,
        subject: rendered.subject,
        body: rendered.body,
        carriesLink: step.carriesLink,
        dedupeKey,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const { count } = await prisma.campaignMessage.updateMany({
    where: { dedupeKey, status: "SCHEDULED" },
    data: { scheduledFor },
  });
  if (count === 0) return null;
  const existing = await prisma.campaignMessage.findUnique({ where: { dedupeKey }, select: { id: true } });
  return existing?.id ?? null;
}
