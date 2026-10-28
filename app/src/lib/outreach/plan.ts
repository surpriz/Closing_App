import { nextBusinessSlot, type BusinessHours } from "@/lib/closing/scheduling/business-hours";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { remainingToday } from "@/lib/mailboxes/caps/allowance";

import { dedupeKeyOf, scheduleStepMessage, type StepRow } from "./messages";
import { releaseCampaignLink } from "./ownership";
import { businessHoursOf, firstSendSlots, localDayBounds, nextStepFor, stepSendAt } from "./planner";
import { organizationWhere, type OutreachScope } from "./scope";

const CATCH_UP_BATCH = 200;
const STEP_SELECT = {
  id: true,
  order: true,
  delayDays: true,
  subject: true,
  newThread: true,
  body: true,
  carriesLink: true,
} as const;

/**
 * D2: first messages of QUEUED enrollments, paced by today's allowance; then ACTIVE enrollments left without a
 * pending message (the next step, or the end of the sequence).
 */
export async function planEnrollments(
  now: Date,
  scope: OutreachScope = {},
): Promise<{ started: number; continued: number; finished: number }> {
  const totals = { started: 0, continued: 0, finished: 0 };
  const orgFilter = { ...organizationWhere(scope), organization: { suspendedAt: null } };
  const hoursByOrg = new Map<string, BusinessHours>();
  const hoursOf = async (organizationId: string) => {
    let hours = hoursByOrg.get(organizationId);
    if (!hours) {
      hours = businessHoursOf(await getWorkspaceSettings(organizationId));
      hoursByOrg.set(organizationId, hours);
    }
    return hours;
  };

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: "ACTIVE",
      ...orgFilter,
      campaigns: { some: { status: "ACTIVE", enrollments: { some: { status: "QUEUED" } } } },
    },
    select: {
      id: true,
      organizationId: true,
      timezone: true,
      rampStartedAt: true,
      dailyCap: true,
      sentDay: true,
      sentCount: true,
    },
  });

  for (const mailbox of mailboxes) {
    const hours = await hoursOf(mailbox.organizationId);
    const allowance = remainingToday(mailbox, now, { max: getEnv().MAILBOX_DAILY_CAP_MAX });
    const today = localDayBounds(now, mailbox.timezone);
    const scheduledToday = await prisma.campaignMessage.count({
      where: {
        mailboxId: mailbox.id,
        status: "SCHEDULED",
        scheduledFor: { gte: today.start, lt: today.end },
      },
    });
    const take = Math.max(0, allowance - scheduledToday);
    if (take === 0) continue;

    const queued = await prisma.campaignProspect.findMany({
      where: { status: "QUEUED", campaign: { mailboxId: mailbox.id, status: "ACTIVE", steps: { some: { order: 1 } } } },
      orderBy: { createdAt: "asc" },
      take,
      include: { campaign: { select: { id: true, steps: { where: { order: 1 }, select: STEP_SELECT, take: 1 } } } },
    });
    const slots = firstSendSlots({
      count: queued.length,
      from: now,
      mailboxTimeZone: mailbox.timezone,
      hours,
      mailboxId: mailbox.id,
    });

    for (const [index, enrollment] of queued.entries()) {
      const step = enrollment.campaign.steps[0];
      const slot = slots[index];
      if (!step || !slot) continue;
      // The slot is in the mailbox's day; the prospect's own business hours still apply
      const at = nextBusinessSlot(slot, enrollment.timezone, hours, "asap");
      const scheduled = await scheduleStepMessage({
        enrollment,
        step,
        campaignId: enrollment.campaign.id,
        mailboxId: mailbox.id,
        scheduledFor: at,
      });
      await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "QUEUED" },
        data: { status: "ACTIVE", nextSendAt: at },
      });
      if ("id" in scheduled) totals.started++;
    }
  }

  // Catch-up: an ACTIVE enrollment with nothing pending (the sender normally plans the next step itself)
  const stranded = await prisma.campaignProspect.findMany({
    where: {
      status: "ACTIVE",
      currentStep: { gt: 0 },
      ...orgFilter,
      campaign: { status: "ACTIVE", mailbox: { status: "ACTIVE" } },
      messages: { none: { status: { in: ["SCHEDULED", "SENDING"] } } },
      // One waiting for a later time is left alone until then: no point re-reading it every tick
      OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
    },
    // Least recently touched first, so a long list of waiting enrollments cannot starve the others
    orderBy: { updatedAt: "asc" },
    take: CATCH_UP_BATCH,
    include: {
      campaign: { select: { id: true, mailboxId: true, steps: { orderBy: { order: "asc" }, select: STEP_SELECT } } },
      messages: { where: { status: "SENT" }, orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
    },
  });

  for (const enrollment of stranded) {
    const { campaign } = enrollment;
    if (!campaign.mailboxId) continue;
    const hours = await hoursOf(enrollment.organizationId);
    const action = nextStepFor({
      enrollment: {
        status: "ACTIVE",
        currentStep: enrollment.currentStep,
        lastSentAt: enrollment.messages[0]?.sentAt ?? null,
      },
      steps: campaign.steps,
      now,
    });

    if (action.kind === "send_step") {
      const step: StepRow = campaign.steps.find((s) => s.id === action.step.id)!;
      const at = stepSendAt(action.earliest, enrollment.timezone, hours, dedupeKeyOf(enrollment.id, step.id));
      const scheduled = await scheduleStepMessage({
        enrollment,
        step,
        campaignId: campaign.id,
        mailboxId: campaign.mailboxId,
        scheduledFor: at,
      });
      if ("id" in scheduled) {
        await prisma.campaignProspect.updateMany({
          where: { id: enrollment.id, status: "ACTIVE" },
          data: { nextSendAt: at },
        });
        totals.continued++;
      } else if (scheduled.existing === "SENT") {
        // The mail left but the enrollment never moved on: repair it, the next pass plans the following step
        await prisma.campaignProspect.updateMany({
          where: { id: enrollment.id, status: "ACTIVE" },
          data: { currentStep: step.order },
        });
      } else if (scheduled.existing === "FAILED" || scheduled.existing === "CANCELLED") {
        await prisma.campaignProspect.updateMany({
          where: { id: enrollment.id, status: "ACTIVE" },
          data: { status: "PAUSED", pausedReason: "send_failed", pausedAt: now },
        });
      }
    } else if (action.kind === "finish") {
      const { count } = await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { status: "FINISHED", finishedAt: now },
      });
      if (count === 0) continue;
      if (enrollment.linkId) await releaseCampaignLink(enrollment.linkId);
      totals.finished++;
    } else if (action.kind === "wait" && action.until) {
      // After the last step: nothing more will be sent, so nextSendAt stays empty (it is not the finish time). The write
      // still bumps updatedAt, which sends it to the back of the least-recently-touched line
      await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { nextSendAt: null },
      });
    }
  }

  return totals;
}
