"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";

import type { AdminActionState } from "./user-actions";

/**
 * Suspending a workspace locks every member out (see resolveWorkspace), stops
 * its links and the engine's work on it. Nothing is deleted.
 */

const reasonSchema = z.string().trim().min(3, "Indiquez un motif.").max(500, "Motif trop long.");

function refresh(organizationId: string) {
  revalidatePath("/admin/workspaces");
  revalidatePath(`/admin/workspaces/${organizationId}`);
}

export async function suspendWorkspace(organizationId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const reason = reasonSchema.safeParse(formData.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0]?.message };
  const ownMembership = await prisma.member.findFirst({ where: { organizationId, userId: admin.id }, select: { id: true } });
  if (ownMembership) return { error: "Vous êtes membre de cet espace, il ne peut pas être suspendu." };

  const { count } = await prisma.organization.updateMany({
    where: { id: organizationId, suspendedAt: null },
    data: { suspendedAt: new Date(), suspendedReason: reason.data },
  });
  if (count === 0) return { error: "Espace introuvable ou déjà suspendu." };
  await logAdminAction({
    actorId: admin.id,
    action: "organization.suspend",
    targetType: "organization",
    targetId: organizationId,
    reason: reason.data,
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
