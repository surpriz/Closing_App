"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseReason, type AdminActionState } from "@/lib/admin/action-state";
import { logAdminAction } from "@/lib/admin/audit";
import { COMPED_STATUS } from "@/lib/billing/plans";
import { DAY_MS } from "@/lib/closing/constants";
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

const billingSchema = z.object({
  grant: z.enum(["", "solo", "team", "enterprise", "none"], "Plan invalide."),
  trialDays: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number("Durée d'essai invalide (0 à 365 jours).").int().min(0).max(365).nullable()),
});

/**
 * Grants a plan without Stripe (Enterprise, partners) or sets the trial end (0 days ends it now).
 * A workspace that pays through Stripe is managed there, not here.
 */
export async function setWorkspaceBilling(organizationId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const reason = parseReason(formData);
  if ("error" in reason) return reason;
  const parsed = billingSchema.safeParse({ grant: formData.get("grant") ?? "", trialDays: formData.get("trialDays") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const { grant, trialDays } = parsed.data;
  if (!grant && trialDays === null) return { error: "Rien à changer." };

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { planStatus: true } });
  if (!org) return { error: "Espace introuvable." };
  if (grant && org.planStatus && org.planStatus !== COMPED_STATUS) return { error: "Abonnement Stripe en cours : à gérer dans Stripe." };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(grant === "none" && { plan: "free", planStatus: null }),
      ...(grant && grant !== "none" && { plan: grant, planStatus: COMPED_STATUS }),
      ...(trialDays !== null && { trialEndsAt: new Date(Date.now() + trialDays * DAY_MS) }),
    },
  });
  await logAdminAction({
    actorId: admin.id,
    action: "organization.billing",
    targetType: "organization",
    targetId: organizationId,
    reason: reason.reason,
    metadata: { grant: grant || null, trialDays },
  });
  refresh(organizationId);
  return { ok: true };
}
