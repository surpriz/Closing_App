"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { editableLinks, sellerLinks } from "@/lib/closing/dashboard/queries";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { shiftLinkBack } from "@/lib/closing/testing/time-travel";
import { runClosingTick } from "@/lib/closing/engine";
import { isLinkExpired } from "@/lib/closing/expiry";
import { sendFollowup } from "@/lib/closing/followups/dispatch";
import { cancelOpenFollowups, OPEN_FOLLOWUP_STATUSES } from "@/lib/closing/followups/queue";
import {
  approveFollowup as approve,
  markFollowupSentManually,
  regenerateFollowup as regenerate,
  updateFollowupDraft,
} from "@/lib/closing/followups/review";
import { prisma } from "@/lib/db";
import { isCampaignOwned } from "@/lib/outreach/ownership";
import { requireWorkspace } from "@/lib/session";
import { testToolsEnabled } from "@/lib/test-tools";

// A teammate's deal can be opened, not changed: it reads as not found here
async function requireOwnedLink(linkId: string) {
  const workspace = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id: linkId, organizationId: workspace.organization.id, ...editableLinks(workspace) },
    select: { id: true, documentId: true },
  });
  if (!link) throw new Error("Lien introuvable");
  return link;
}

async function requireOwnedFollowup(followupId: string) {
  const workspace = await requireWorkspace();
  const { organization, user } = workspace;
  const followup = await prisma.followup.findFirst({
    where: { id: followupId, link: { organizationId: organization.id, ...editableLinks(workspace) } },
    select: { id: true, link: { select: { id: true, documentId: true, expiresAt: true } } },
  });
  if (!followup) throw new Error("Relance introuvable");
  return { ...followup, userId: user.id };
}

function revalidateFollowup(followup: { link: { id: string; documentId: string } }) {
  revalidatePath(`/links/${followup.link.id}`);
  revalidatePath("/drafts");
  revalidatePath(`/documents/${followup.link.documentId}`);
  revalidatePath("/dashboard");
}

function assertTestTools() {
  if (!testToolsEnabled()) throw new Error("Outils de test désactivés");
}

export async function toggleLinkFollowups(linkId: string, enabled: boolean) {
  const link = await requireOwnedLink(linkId);
  // A campaign drives this link's messages: the seller leaves it to the campaign (or stops it there)
  const owner = await prisma.link.findUnique({ where: { id: link.id }, select: { campaignOwned: true } });
  if (owner && isCampaignOwned(owner)) {
    const t = await getTranslations("deal.followupActions");
    return { ok: false as const, error: t("campaignOwned") };
  }
  await prisma.link.update({ where: { id: link.id }, data: { followupsEnabled: enabled } });
  if (!enabled) await cancelOpenFollowups(link.id, "followupsOff");
  revalidatePath(`/documents/${link.documentId}`);
  return { ok: true as const };
}

export async function sendFollowupNow(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  // sendFollowup ignores scheduledFor, so the planned slot stays visible.
  // Sending a draft from here counts as approving it.
  const outcome = await sendFollowup(followup.id, { approvedById: followup.userId });
  revalidateFollowup(followup);
  return { outcome };
}

export async function cancelFollowup(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  const t = await getTranslations("deal.followupActions");
  await prisma.followup.updateMany({
    where: { id: followup.id, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), error: t("cancelledBySeller") },
  });
  revalidateFollowup(followup);
}

const draftSchema = (emptyMessage: string) =>
  z.object({
  subject: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  body: z.string().trim().min(1, emptyMessage).max(4000),
});

export async function saveFollowupDraft(followupId: string, draft: { subject: string; body: string }) {
  const followup = await requireOwnedFollowup(followupId);
  const t = await getTranslations("deal.followupActions");
  const parsed = draftSchema(t("emptyMessage")).safeParse(draft);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidMessage") };
  const ok = await updateFollowupDraft(followup.id, parsed.data);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: t("cannotEdit") };
}

export async function approveFollowup(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  const t = await getTranslations("deal.followupActions");
  if (isLinkExpired(followup.link, new Date())) return { error: t("expiredLink") };
  const ok = await approve(followup.id, followup.userId);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: t("notToApprove") };
}

/** "Tout valider": every draft waiting on the seller's own deals goes to its send slot. */
export async function approveAllDrafts() {
  const workspace = await requireWorkspace();
  const now = new Date();
  const drafts = await prisma.followup.findMany({
    where: { status: "DRAFT", link: { organizationId: workspace.organization.id, ...sellerLinks(workspace.scope) } },
    select: { id: true, link: { select: { id: true, documentId: true, expiresAt: true } } },
    take: 200,
  });
  let approved = 0;
  for (const draft of drafts) {
    // A locked link: its message would point to nothing, it stays for the seller to look at
    if (isLinkExpired(draft.link, now)) continue;
    if (await approve(draft.id, workspace.user.id, now)) approved++;
  }
  revalidatePath("/drafts");
  revalidatePath("/dashboard");
  return { approved, skipped: drafts.length - approved };
}

export async function markFollowupSentByMe(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  const t = await getTranslations("deal.followupActions");
  if (isLinkExpired(followup.link, new Date())) return { error: t("expiredLink") };
  const ok = await markFollowupSentManually(followup.id, followup.userId);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: t("alreadyGone") };
}

export async function regenerateFollowup(followupId: string, instruction: string) {
  const followup = await requireOwnedFollowup(followupId);
  const cleaned = instruction.trim().slice(0, 300) || null;
  const ok = await regenerate(followup.id, cleaned);
  revalidateFollowup(followup);
  const t = await getTranslations("deal.followupActions");
  return ok ? { ok: true } : { error: t("cannotRewrite") };
}

// Testing helpers (local dev, staging): run the engine without waiting for the
// scheduler, and make a deal look days older.
export async function runEngineNow() {
  assertTestTools();
  await requireWorkspace();
  const result = await runClosingTick();
  revalidatePath("/", "layout");
  return result;
}

/** Makes `days` pass for this deal, then refreshes what depends on time. */
export async function timeTravelLink(linkId: string, days: number) {
  assertTestTools();
  const link = await requireOwnedLink(linkId);
  await shiftLinkBack(link.id, days);
  await refreshEngagementScore(link.id);
  revalidatePath("/", "layout");
}

