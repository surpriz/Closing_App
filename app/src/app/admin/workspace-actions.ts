"use server";

import { revalidatePath } from "next/cache";

import { parseReason, type AdminActionState } from "@/lib/admin/action-state";
import { logAdminAction } from "@/lib/admin/audit";
import { COMPED_STATUS, isPlanId } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";

/**
 * Suspending a workspace locks every member out (see resolveWorkspace), stops
 * its links and the engine's work on it. Nothing is deleted.
 */

function refresh(organizationId: string) {
  revalidatePath("/admin/workspaces");
  revalidatePath(`/admin/workspaces/${organizationId}`);
}

export async function suspendWorkspace(organizationId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const parsed = parseReason(formData);
  if ("error" in parsed) return parsed;
  const ownMembership = await prisma.member.findFirst({ where: { organizationId, userId: admin.id }, select: { id: true } });
  if (ownMembership) return { error: "Vous êtes membre de cet espace, il ne peut pas être suspendu." };

  const { count } = await prisma.organization.updateMany({
    where: { id: organizationId, suspendedAt: null },
    data: { suspendedAt: new Date(), suspendedReason: parsed.reason },
  });
  if (count === 0) return { error: "Espace introuvable ou déjà suspendu." };
  await logAdminAction({
    actorId: admin.id,
    action: "organization.suspend",
    targetType: "organization",
    targetId: organizationId,
    reason: parsed.reason,
  });
  refresh(organizationId);
  return { ok: true };
}

export async function reactivateWorkspace(organizationId: string): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const { count } = await prisma.organization.updateMany({
    where: { id: organizationId, suspendedAt: { not: null } },
    data: { suspendedAt: null, suspendedReason: null },
  });
  if (count === 0) return { error: "Espace introuvable ou déjà actif." };
  await logAdminAction({
    actorId: admin.id,
    action: "organization.reactivate",
    targetType: "organization",
    targetId: organizationId,
  });
  refresh(organizationId);
  return { ok: true };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Grants a plan without Stripe (Enterprise, partners) or sets the trial end.
 * A workspace that pays through Stripe is managed there, not here.
 */
export async function setWorkspaceBilling(organizationId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const parsed = parseReason(formData);
  if ("error" in parsed) return parsed;
  const grant = String(formData.get("grant") ?? "");
  const trialDays = String(formData.get("trialDays") ?? "").trim();

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { planStatus: true } });
  if (!org) return { error: "Espace introuvable." };

  const data: { plan?: string; planStatus?: string | null; trialEndsAt?: Date | null } = {};
  if (grant) {
    if (org.planStatus && org.planStatus !== COMPED_STATUS) return { error: "Abonnement Stripe en cours : à gérer dans Stripe." };
    if (grant === "none") Object.assign(data, { plan: "free", planStatus: null });
    else if (isPlanId(grant) && grant !== "free") Object.assign(data, { plan: grant, planStatus: COMPED_STATUS });
    else return { error: "Plan invalide." };
  }
  if (trialDays) {
    const days = Number(trialDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) return { error: "Durée d'essai invalide (0 à 365 jours)." };
    data.trialEndsAt = days === 0 ? new Date() : new Date(Date.now() + days * DAY_MS);
  }
  if (Object.keys(data).length === 0) return { error: "Rien à changer." };

  await prisma.organization.update({ where: { id: organizationId }, data });
  await logAdminAction({
    actorId: admin.id,
    action: "organization.billing",
    targetType: "organization",
    targetId: organizationId,
    reason: parsed.reason,
    metadata: { grant: grant || null, trialDays: trialDays || null },
  });
  refresh(organizationId);
  return { ok: true };
}
