import { cache } from "react";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { effectivePlan, quota, startOfUtcMonth, type BillingFacts, type EffectivePlan } from "./plans";

export const BILLING_SELECT = {
  plan: true,
  planStatus: true,
  trialEndsAt: true,
  betaGrace: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
} as const;

export function isBillingEnabled() {
  return !!getEnv().STRIPE_SECRET_KEY;
}

/** The plan in force for a workspace row already loaded (requireWorkspace, the viewer). */
export function planFor(org: BillingFacts, now = new Date()): EffectivePlan {
  return effectivePlan(org, now, { betaGraceUntil: getEnv().BETA_GRACE_UNTIL ?? null, billingEnabled: isBillingEnabled() });
}

export const getWorkspacePlan = cache(async (organizationId: string) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: BILLING_SELECT });
  return planFor(org);
});

/** Seller links created this month, drafts included: a draft is sent by copying it. */
export function countLinksCreatedThisMonth(organizationId: string, now = new Date()) {
  return prisma.link.count({
    where: { organizationId, parentLinkId: null, isOnboardingTest: false, createdAt: { gte: startOfUtcMonth(now) } },
  });
}

export function countAiFollowupsThisMonth(organizationId: string, now = new Date()) {
  return prisma.followup.count({
    where: {
      link: { organizationId },
      createdAt: { gte: startOfUtcMonth(now) },
      aiProvider: { not: "template" },
      NOT: { aiProvider: null },
    },
  });
}

export function countVideoPitches(organizationId: string) {
  return prisma.document.count({ where: { organizationId, kind: "VIDEO", archivedAt: null } });
}

export type UpgradeReason =
  | "links"
  | "videoPitch"
  | "autopilot"
  | "chat"
  | "translation"
  | "voice"
  | "team"
  | "invites"
  | "slack"
  | "webhooks";

/** A plan limit stopped a creation: callers turn it into an upgrade prompt. */
export class PlanLimitError extends Error {
  constructor(
    readonly reason: UpgradeReason,
    readonly used?: number,
    readonly max?: number | null,
  ) {
    super(`plan_limit:${reason}`);
  }
}

export async function linkQuota(organizationId: string, now = new Date()) {
  const plan = await getWorkspacePlan(organizationId);
  if (plan.limits.linksPerMonth === null) return quota(null, 0);
  return quota(plan.limits.linksPerMonth, await countLinksCreatedThisMonth(organizationId, now));
}

export async function assertCanCreateLink(organizationId: string) {
  const links = await linkQuota(organizationId);
  if (!links.allowed) throw new PlanLimitError("links", links.used, links.max);
}

export async function videoPitchQuota(organizationId: string) {
  const plan = await getWorkspacePlan(organizationId);
  if (plan.limits.videoPitches === null) return quota(null, 0);
  return quota(plan.limits.videoPitches, await countVideoPitches(organizationId));
}

export async function assertCanAddVideoPitch(organizationId: string) {
  const pitches = await videoPitchQuota(organizationId);
  if (!pitches.allowed) throw new PlanLimitError("videoPitch", pitches.used, pitches.max);
}
