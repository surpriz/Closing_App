"use server";

import { isAPIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminEmail, normalizeEmail } from "@/lib/platform-admin";
import { requirePlatformAdmin } from "@/lib/session";

/**
 * Disabling, banning and reactivating accounts. Better Auth's admin plugin
 * cuts the web sessions and refuses new ones; the extension tokens and the
 * email blocklist are ours.
 */

export type AdminActionState = { ok?: boolean; error?: string } | null;

const reasonSchema = z.string().trim().min(3, "Indiquez un motif.").max(500, "Motif trop long.");
const durationSchema = z.enum(["1", "7", "30", "none"]);

const DAY_S = 24 * 60 * 60;

async function target(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return { error: "Utilisateur introuvable." } as const;
  if (isPlatformAdminEmail(user.email)) return { error: "Le compte admin ne peut pas être modifié." } as const;
  return { user } as const;
}

function failed(error: unknown): AdminActionState {
  const message = isAPIError(error) ? error.message : null;
  console.error("[admin]", error);
  return { error: message || "Ça n'a pas marché, réessayez." };
}

function refresh(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function disableUser(userId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;
  const reason = reasonSchema.safeParse(formData.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0]?.message };
  const duration = durationSchema.safeParse(formData.get("duration"));
  if (!duration.success) return { error: "Durée inconnue." };
  const days = duration.data === "none" ? null : Number(duration.data);

  try {
    await auth.api.banUser({
      body: { userId, banReason: reason.data, ...(days && { banExpiresIn: days * DAY_S }) },
      headers: await headers(),
    });
  } catch (error) {
    return failed(error);
  }
  await logAdminAction({
    actorId: admin.id,
    action: "user.disable",
    targetType: "user",
    targetId: userId,
    reason: reason.data,
    metadata: { days },
  });
  refresh(userId);
  return { ok: true };
}

export async function banUser(userId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;
  const reason = reasonSchema.safeParse(formData.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0]?.message };
  const email = normalizeEmail(found.user.email);
  if (normalizeEmail(String(formData.get("confirm") ?? "")) !== email) {
    return { error: "Tapez l'email du compte pour confirmer." };
  }

  try {
    await auth.api.banUser({ body: { userId, banReason: reason.data }, headers: await headers() });
  } catch (error) {
    return failed(error);
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.blockedEmail.upsert({
      where: { email },
      create: { email, reason: reason.data, createdById: admin.id },
      update: { reason: reason.data, createdById: admin.id },
    }),
    prisma.extensionToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  await logAdminAction({ actorId: admin.id, action: "user.ban", targetType: "user", targetId: userId, reason: reason.data });
  refresh(userId);
  return { ok: true };
}

export async function reactivateUser(userId: string): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;

  try {
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    return failed(error);
  }
  await prisma.blockedEmail.deleteMany({ where: { email: normalizeEmail(found.user.email) } });
  await logAdminAction({ actorId: admin.id, action: "user.reactivate", targetType: "user", targetId: userId });
  refresh(userId);
  return { ok: true };
}

export async function revokeUserSessions(userId: string): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;

  try {
    await auth.api.revokeUserSessions({ body: { userId }, headers: await headers() });
  } catch (error) {
    return failed(error);
  }
  // Extension and Outlook tokens are sessions too
  await prisma.extensionToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await logAdminAction({ actorId: admin.id, action: "user.revoke_sessions", targetType: "user", targetId: userId });
  refresh(userId);
  return { ok: true };
}
