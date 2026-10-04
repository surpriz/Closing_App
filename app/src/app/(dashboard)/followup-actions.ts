"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { shiftLinkBack } from "@/lib/closing/testing/time-travel";
import { runClosingTick } from "@/lib/closing/engine";
import { sendFollowup } from "@/lib/closing/followups/dispatch";
import { cancelOpenFollowups, OPEN_FOLLOWUP_STATUSES } from "@/lib/closing/followups/queue";
import {
  approveFollowup as approve,
  markFollowupSentManually,
  regenerateFollowup as regenerate,
  updateFollowupDraft,
} from "@/lib/closing/followups/review";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";
import { testToolsEnabled } from "@/lib/test-tools";

async function requireOwnedLink(linkId: string) {
  const { organization } = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id: linkId, organizationId: organization.id },
    select: { id: true, documentId: true },
  });
  if (!link) throw new Error("Lien introuvable");
  return link;
}

async function requireOwnedFollowup(followupId: string) {
  const { organization, user } = await requireWorkspace();
  const followup = await prisma.followup.findFirst({
    where: { id: followupId, link: { organizationId: organization.id } },
    select: { id: true, link: { select: { id: true, documentId: true } } },
  });
  if (!followup) throw new Error("Relance introuvable");
  return { ...followup, userId: user.id };
}

function revalidateFollowup(followup: { link: { id: string; documentId: string } }) {
  revalidatePath(`/links/${followup.link.id}`);
  revalidatePath(`/documents/${followup.link.documentId}`);
  revalidatePath("/dashboard");
}

function assertTestTools() {
  if (!testToolsEnabled()) throw new Error("Outils de test désactivés");
}

export async function toggleLinkFollowups(linkId: string, enabled: boolean) {
  const link = await requireOwnedLink(linkId);
  await prisma.link.update({ where: { id: link.id }, data: { followupsEnabled: enabled } });
  if (!enabled) await cancelOpenFollowups(link.id, "Relances désactivées sur ce lien");
  revalidatePath(`/documents/${link.documentId}`);
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
  await prisma.followup.updateMany({
    where: { id: followup.id, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), error: "Annulée par le vendeur" },
  });
  revalidateFollowup(followup);
}

const draftSchema = z.object({
  subject: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  body: z.string().trim().min(1, "Le message est vide.").max(4000),
});

export async function saveFollowupDraft(followupId: string, draft: { subject: string; body: string }) {
  const followup = await requireOwnedFollowup(followupId);
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Message invalide." };
  const ok = await updateFollowupDraft(followup.id, parsed.data);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: "Cette relance ne peut plus être modifiée." };
}

export async function approveFollowup(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  const ok = await approve(followup.id, followup.userId);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: "Cette relance n'est plus à valider." };
}

export async function markFollowupSentByMe(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  const ok = await markFollowupSentManually(followup.id, followup.userId);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: "Cette relance est déjà partie ou annulée." };
}

export async function regenerateFollowup(followupId: string, instruction: string) {
  const followup = await requireOwnedFollowup(followupId);
  const cleaned = instruction.trim().slice(0, 300) || null;
  const ok = await regenerate(followup.id, cleaned);
  revalidateFollowup(followup);
  return ok ? { ok: true } : { error: "Cette relance ne peut plus être réécrite." };
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

