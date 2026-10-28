import { prisma } from "@/lib/db";

import { linkStep, type StepInput, type StepIssue, validateSteps } from "./steps";

export const CAMPAIGN_LOCALES = ["fr", "en"] as const;

/** Who is acting: a campaign is edited by its creator or by a workspace manager (D16, tightened). */
export type Actor = { userId: string; isManager: boolean };

export function canEditCampaign(campaign: { createdById: string }, actor: Actor): boolean {
  return actor.isManager || campaign.createdById === actor.userId;
}

/** A mailbox is bound by the member who owns it, or by a manager. */
function mailboxScope(organizationId: string, actor: Actor) {
  return { organizationId, status: "ACTIVE" as const, ...(actor.isManager ? {} : { userId: actor.userId }) };
}

async function editableCampaign(organizationId: string, id: string, actor: Actor) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId },
    select: { createdById: true, mailboxId: true },
  });
  return campaign && canEditCampaign(campaign, actor) ? campaign : null;
}

const LIVE_ENROLLMENT = ["QUEUED", "ACTIVE", "PAUSED"] as const;
// DONE too: people can be imported into a finished campaign, which then starts again
const RESTARTABLE = ["DRAFT", "PAUSED", "DONE"] as const;
const PENDING_MESSAGE = ["SCHEDULED", "SENDING"] as const;

export async function createCampaign(input: {
  organizationId: string;
  createdById: string;
  name: string;
  locale: string;
  mailboxId: string | null;
  actor: Actor;
  now?: Date;
}): Promise<{ id: string }> {
  // A mailbox of another workspace, a colleague's (for a non-manager) or one that is not ACTIVE is dropped: the UI then shows "no mailbox"
  const mailbox = input.mailboxId
    ? await prisma.mailbox.findFirst({
        where: { id: input.mailboxId, ...mailboxScope(input.organizationId, input.actor) },
        select: { id: true },
      })
    : null;
  // An unsupported locale falls back to the first supported one rather than failing the creation
  const locale = (CAMPAIGN_LOCALES as readonly string[]).includes(input.locale) ? input.locale : CAMPAIGN_LOCALES[0];
  const campaign = await prisma.campaign.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      name: input.name.trim(),
      locale,
      mailboxId: mailbox?.id ?? null,
      status: "DRAFT",
      steps: { create: [{ order: 1, delayDays: 0, subject: "", body: "", newThread: false, carriesLink: false }] },
    },
    select: { id: true },
  });
  return { id: campaign.id };
}

export async function updateCampaign(
  organizationId: string,
  id: string,
  patch: { name?: string; mailboxId?: string | null; documentId?: string | null; locale?: string; linkOnReply?: boolean },
  actor: Actor,
): Promise<boolean> {
  const current = await editableCampaign(organizationId, id, actor);
  if (!current) return false;
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return false;
    data.name = name;
  }
  if (patch.locale !== undefined) {
    if (!(CAMPAIGN_LOCALES as readonly string[]).includes(patch.locale)) return false;
    data.locale = patch.locale;
  }
  if (patch.linkOnReply !== undefined) data.linkOnReply = patch.linkOnReply;
  if (patch.mailboxId !== undefined) {
    // Re-submitting the mailbox the campaign already uses is a no-op, even when it is a colleague's
    if (patch.mailboxId !== null && patch.mailboxId !== current.mailboxId) {
      const mailbox = await prisma.mailbox.findFirst({
        where: { id: patch.mailboxId, ...mailboxScope(organizationId, actor) },
        select: { id: true },
      });
      if (!mailbox) return false;
    }
    data.mailboxId = patch.mailboxId;
  }
  if (patch.documentId !== undefined) {
    if (patch.documentId !== null) {
      const document = await prisma.document.findFirst({
        where: { id: patch.documentId, organizationId, status: "READY", archivedAt: null },
        select: { id: true },
      });
      if (!document) return false;
    }
    data.documentId = patch.documentId;
  }
  const { count } = await prisma.campaign.updateMany({
    where: { id, organizationId, status: { not: "ARCHIVED" } },
    data,
  });
  return count > 0;
}

/** Steps are upserted by order, not recreated: a message already scheduled keeps pointing at its step. */
export async function saveSteps(
  organizationId: string,
  campaignId: string,
  steps: StepInput[],
  actor: Actor,
): Promise<{ ok: true } | { ok: false; issues: StepIssue[] }> {
  const issues = validateSteps(steps);
  if (issues.length > 0) return { ok: false, issues };
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId, status: { not: "ARCHIVED" } },
    select: { id: true, createdById: true },
  });
  if (!campaign || !canEditCampaign(campaign, actor)) return { ok: false, issues: [] };

  const fields = (step: StepInput) => ({
    delayDays: step.delayDays,
    subject: step.order === 1 || step.newThread ? (step.subject?.trim() ?? "") : step.subject?.trim() || null,
    newThread: step.newThread,
    body: step.body,
    carriesLink: step.carriesLink,
  });
  await prisma.$transaction([
    ...steps.map((step) =>
      prisma.campaignStep.upsert({
        where: { campaignId_order: { campaignId, order: step.order } },
        create: { campaignId, order: step.order, ...fields(step) },
        update: fields(step),
      }),
    ),
    prisma.campaignStep.deleteMany({ where: { campaignId, order: { gt: steps.length } } }),
  ]);
  return { ok: true };
}

export type ActivationIssue = "not_found" | "no_mailbox" | "mailbox_not_active" | "steps" | "document_required" | "no_enrollment";

/** DRAFT, PAUSED or DONE to ACTIVE, once the campaign can really send. */
export async function activateCampaign(
  organizationId: string,
  id: string,
  actor: Actor,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; issue: ActivationIssue; steps?: StepIssue[] }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId, status: { in: [...RESTARTABLE] } },
    select: {
      createdById: true,
      startedAt: true,
      documentId: true,
      linkOnReply: true,
      mailbox: { select: { status: true, organizationId: true } },
      steps: {
        orderBy: { order: "asc" },
        select: { order: true, delayDays: true, subject: true, newThread: true, body: true, carriesLink: true },
      },
    },
  });
  if (!campaign || !canEditCampaign(campaign, actor)) return { ok: false, issue: "not_found" };
  if (!campaign.mailbox || campaign.mailbox.organizationId !== organizationId) return { ok: false, issue: "no_mailbox" };
  if (campaign.mailbox.status !== "ACTIVE") return { ok: false, issue: "mailbox_not_active" };
  const stepIssues = validateSteps(campaign.steps);
  if (stepIssues.length > 0) return { ok: false, issue: "steps", steps: stepIssues };
  if ((linkStep(campaign.steps) !== null || campaign.linkOnReply) && !campaign.documentId) {
    return { ok: false, issue: "document_required" };
  }
  const enrolled = await prisma.campaignProspect.findFirst({
    where: { campaignId: id, status: { in: [...LIVE_ENROLLMENT] } },
    select: { id: true },
  });
  if (!enrolled) return { ok: false, issue: "no_enrollment" };

  const { count } = await prisma.campaign.updateMany({
    where: { id, organizationId, status: { in: [...RESTARTABLE] } },
    data: { status: "ACTIVE", startedAt: campaign.startedAt ?? now, pausedAt: null, finishedAt: null },
  });
  return count > 0 ? { ok: true } : { ok: false, issue: "not_found" };
}

export async function pauseCampaign(organizationId: string, id: string, actor: Actor, now: Date = new Date()): Promise<boolean> {
  if (!(await editableCampaign(organizationId, id, actor))) return false;
  const { count } = await prisma.campaign.updateMany({
    where: { id, organizationId, status: "ACTIVE" },
    data: { status: "PAUSED", pausedAt: now },
  });
  return count > 0;
}

/** Cancels what has not left yet and stops everyone still in the sequence. Status flips last: a failed run can be retried. */
export async function archiveCampaign(organizationId: string, id: string, actor: Actor, now: Date = new Date()): Promise<boolean> {
  if (!(await editableCampaign(organizationId, id, actor))) return false;
  const results = await prisma.$transaction([
    prisma.campaignMessage.updateMany({
      where: { campaignId: id, campaign: { organizationId }, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    }),
    prisma.campaignProspect.updateMany({
      where: { campaignId: id, organizationId, status: { in: [...LIVE_ENROLLMENT] } },
      data: { status: "STOPPED", finishedAt: now, pausedReason: "archived" },
    }),
    prisma.campaign.updateMany({
      where: { id, organizationId, status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", archivedAt: now },
    }),
  ]);
  return results[2].count > 0;
}

/** An ACTIVE campaign nobody is in anymore, with nothing left to send, is done. Conditions are rechecked in the update. */
export async function finishIdleCampaigns(now: Date, scope: { organizationId?: string } = {}): Promise<number> {
  const { count } = await prisma.campaign.updateMany({
    where: {
      status: "ACTIVE",
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      enrollments: { some: {}, none: { status: { in: [...LIVE_ENROLLMENT] } } },
      messages: { none: { status: { in: [...PENDING_MESSAGE] } } },
    },
    data: { status: "DONE", finishedAt: now },
  });
  return count;
}

/** Policy bounces on a mailbox: its running campaigns stop until the seller looks. */
export async function pauseCampaignsOfMailbox(mailboxId: string, now: Date): Promise<number> {
  const { count } = await prisma.campaign.updateMany({
    where: { mailboxId, status: "ACTIVE" },
    data: { status: "PAUSED", pausedAt: now },
  });
  return count;
}
