"use server";

import { revalidatePath } from "next/cache";

import { runClosingTick } from "@/lib/closing/engine";
import { sendFollowup } from "@/lib/closing/followups/dispatch";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const { organization } = await requireWorkspace();
  const followup = await prisma.followup.findFirst({
    where: { id: followupId, link: { organizationId: organization.id } },
    select: { id: true, link: { select: { documentId: true } } },
  });
  if (!followup) throw new Error("Relance introuvable");
  return followup;
}

function assertDev() {
  if (process.env.NODE_ENV !== "development") throw new Error("Disponible en local uniquement");
}

export async function toggleLinkFollowups(linkId: string, enabled: boolean) {
  const link = await requireOwnedLink(linkId);
  await prisma.link.update({ where: { id: link.id }, data: { followupsEnabled: enabled } });
  if (!enabled) await cancelOpenFollowups(link.id, "Relances désactivées sur ce lien");
  revalidatePath(`/documents/${link.documentId}`);
}

export async function sendFollowupNow(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  // sendFollowup ignores scheduledFor, so the planned slot stays visible
  const outcome = await sendFollowup(followup.id);
  revalidatePath(`/documents/${followup.link.documentId}`);
  return { outcome };
}

export async function cancelFollowup(followupId: string) {
  const followup = await requireOwnedFollowup(followupId);
  await prisma.followup.updateMany({
    where: { id: followup.id, status: { in: ["PENDING", "GENERATED", "SCHEDULED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), error: "Annulée par le vendeur" },
  });
  revalidatePath(`/documents/${followup.link.documentId}`);
}

// Local testing helpers: run the engine without waiting for the scheduler,
// and pretend a link was sent days ago to trigger anti-ghosting.
export async function runEngineNow() {
  assertDev();
  await requireWorkspace();
  const result = await runClosingTick();
  revalidatePath("/documents", "layout");
  return result;
}

export async function simulateLinkSentDaysAgo(linkId: string, days: number) {
  assertDev();
  const link = await requireOwnedLink(linkId);
  await prisma.link.update({
    where: { id: link.id },
    data: { sentAt: new Date(Date.now() - days * DAY_MS) },
  });
  revalidatePath(`/documents/${link.documentId}`);
}
