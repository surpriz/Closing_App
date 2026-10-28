import type { CampaignMessageKind, CampaignStatus } from "@/generated/prisma/enums";
import type { SellerScope } from "@/lib/closing/dashboard/queries";
import { RESULTS_FOLLOWUP_DAYS } from "@/lib/closing/results/queries";
import { groupOutcomes, sendHourKey, type FollowupRow, type OutcomeGroup } from "@/lib/closing/results/stats";
import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const MESSAGES_READ = 5000;

export type CampaignOutcome = {
  id: string;
  name: string;
  status: CampaignStatus;
  enrolled: number;
  sent: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
};

export function stepKey(order: number) {
  return `step:${order}`;
}

/** A sent campaign email as a follow-up row, so the "Résultats" helpers read it as they read a follow-up. */
export function campaignMessageRow(m: {
  kind: CampaignMessageKind;
  stepOrder: number | null;
  followupTrigger: string | null;
  sentAt: Date;
  timezone: string;
  clickedAt: Date | null;
  repliedAt: Date | null;
  bouncedAt: Date | null;
  meetingBookedAt: Date | null;
}): FollowupRow | null {
  const trigger = m.kind === "STEP" ? (m.stepOrder === null ? null : stepKey(m.stepOrder)) : m.followupTrigger;
  if (!trigger) return null;
  return {
    trigger,
    goal: null,
    sentAt: m.sentAt,
    timezone: m.timezone,
    clickedAt: m.clickedAt,
    repliedAt: m.repliedAt,
    bouncedAt: m.bouncedAt,
    meetingBookedAt: m.meetingBookedAt,
  };
}

async function sentRows(where: Record<string, unknown>): Promise<FollowupRow[]> {
  const messages = await prisma.campaignMessage.findMany({
    where: { status: "SENT", ...where },
    select: {
      kind: true,
      stepId: true,
      campaignId: true,
      sentAt: true,
      clickedAt: true,
      repliedAt: true,
      bouncedAt: true,
      followup: { select: { trigger: true } },
      enrollment: { select: { timezone: true, link: { select: { meetingBookedAt: true } } } },
    },
    take: MESSAGES_READ,
  });
  if (messages.length === 0) return [];
  // No relation from a message to its step: one query for the steps of the campaigns concerned
  const steps = await prisma.campaignStep.findMany({
    where: { campaignId: { in: [...new Set(messages.map((m) => m.campaignId))] } },
    select: { id: true, order: true },
  });
  const orderOf = new Map(steps.map((step) => [step.id, step.order]));
  return messages.flatMap((m) => {
    if (!m.sentAt) return [];
    const row = campaignMessageRow({
      kind: m.kind,
      stepOrder: m.stepId ? (orderOf.get(m.stepId) ?? null) : null,
      followupTrigger: m.followup?.trigger ?? null,
      sentAt: m.sentAt,
      timezone: m.enrollment.timezone,
      clickedAt: m.clickedAt,
      repliedAt: m.repliedAt,
      bouncedAt: m.bouncedAt,
      meetingBookedAt: m.enrollment.link?.meetingBookedAt ?? null,
    });
    return row ? [row] : [];
  });
}

/** What the cold email campaigns led to, for one seller (their own campaigns) or the workspace (owner = null). */
export async function getCampaignResults(organizationId: string, owner: SellerScope | null, now = new Date()) {
  const campaignScope = { organizationId, ...(owner && { createdById: owner.userId }) };
  const [rows, campaigns] = await Promise.all([
    sentRows({
      sentAt: { gte: new Date(now.getTime() - RESULTS_FOLLOWUP_DAYS * DAY_MS) },
      campaign: campaignScope,
    }),
    prisma.campaign.findMany({
      where: { ...campaignScope, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  const ids = campaigns.map((campaign) => campaign.id);
  const [enrollments, messages] = ids.length
    ? await Promise.all([
        prisma.campaignProspect.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: ids } }, _count: { _all: true } }),
        prisma.campaignMessage.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: ids }, status: "SENT" },
          _count: { _all: true, clickedAt: true },
        }),
      ])
    : [[], []];

  const byCampaign = campaigns.map((campaign): CampaignOutcome => {
    const mine = enrollments.filter((group) => group.campaignId === campaign.id);
    const count = (status: string) => mine.find((group) => group.status === status)?._count._all ?? 0;
    const sent = messages.find((group) => group.campaignId === campaign.id)?._count;
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      enrolled: mine.reduce((sum, group) => sum + group._count._all, 0),
      sent: sent?._all ?? 0,
      clicked: sent?.clickedAt ?? 0,
      replied: count("REPLIED"),
      bounced: count("BOUNCED"),
      unsubscribed: count("UNSUBSCRIBED"),
    };
  });

  return {
    sent: rows.length,
    byCampaign,
    byStep: groupOutcomes(rows, (row) => row.trigger),
    byHour: groupOutcomes(rows, sendHourKey).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** One campaign over its whole life: a line per step (in order), then one per AI follow-up trigger. */
export async function getStepStats(campaignId: string): Promise<(OutcomeGroup & { order: number | null })[]> {
  const rows = await sentRows({ campaignId });
  const orderOf = (key: string) => (key.startsWith("step:") ? Number(key.slice(5)) : null);
  return groupOutcomes(rows, (row) => row.trigger)
    .map((group) => ({ ...group, order: orderOf(group.key) }))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.key.localeCompare(b.key));
}
