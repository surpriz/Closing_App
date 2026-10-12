"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { blockEmailAddress, revokeExtensionTokens } from "@/lib/admin/accounts";
import { adminErrorMessage, parseReason, type AdminActionState } from "@/lib/admin/action-state";
import { logAdminAction } from "@/lib/admin/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminEmail, isUserBlocked, normalizeEmail } from "@/lib/platform-admin";
import { requirePlatformAdmin } from "@/lib/session";

/**
 * Disabling, banning and reactivating accounts. Better Auth's admin plugin
 * cuts the web sessions and refuses new ones; the extension tokens and the
 * email blocklist are ours.
 */

const durationSchema = z.enum(["1", "7", "30", "none"]);

const DAY_S = 24 * 60 * 60;

async function target(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, banned: true, banExpires: true },
  });
  if (!user) return { error: "Utilisateur introuvable." } as const;
  if (isPlatformAdminEmail(user.email)) return { error: "Le compte admin ne peut pas être modifié." } as const;
  return { user } as const;
}

function refresh(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function disableUser(userId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;
  const parsed = parseReason(formData);
  if ("error" in parsed) return parsed;
  const duration = durationSchema.safeParse(formData.get("duration"));
  if (!duration.success) return { error: "Durée inconnue." };
  const days = duration.data === "none" ? null : Number(duration.data);

  try {
    await auth.api.banUser({
      body: { userId, banReason: parsed.reason, ...(days && { banExpiresIn: days * DAY_S }) },
      headers: await headers(),
    });
  } catch (error) {
    return { error: adminErrorMessage(error) };
  }
  await logAdminAction({
    actorId: admin.id,
    action: "user.disable",
    targetType: "user",
    targetId: userId,
    reason: parsed.reason,
    metadata: { days },
  });
  refresh(userId);
  return { ok: true };
}

export async function banUser(userId: string, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;
  const parsed = parseReason(formData);
  if ("error" in parsed) return parsed;
  if (normalizeEmail(String(formData.get("confirm") ?? "")) !== normalizeEmail(found.user.email)) {
    return { error: "Tapez l'email du compte pour confirmer." };
  }

  try {
    await auth.api.banUser({ body: { userId, banReason: parsed.reason }, headers: await headers() });
  } catch (error) {
    return { error: adminErrorMessage(error) };
  }
  await Promise.all([blockEmailAddress(found.user.email, parsed.reason, admin.id), revokeExtensionTokens(userId)]);
  await logAdminAction({ actorId: admin.id, action: "user.ban", targetType: "user", targetId: userId, reason: parsed.reason });
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
    return { error: adminErrorMessage(error) };
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
    return { error: adminErrorMessage(error) };
  }
  await revokeExtensionTokens(userId);
  await logAdminAction({ actorId: admin.id, action: "user.revoke_sessions", targetType: "user", targetId: userId });
  refresh(userId);
  return { ok: true };
}

/** Opens the app as this user for one hour; the banner in the app leads back. */
export async function impersonateUser(userId: string): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const found = await target(userId);
  if ("error" in found) return found;
  if (isUserBlocked(found.user)) return { error: "Réactivez le compte avant de vous y connecter." };

  try {
    await auth.api.impersonateUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    return { error: adminErrorMessage(error) };
  }
  await logAdminAction({ actorId: admin.id, action: "user.impersonate", targetType: "user", targetId: userId });
  redirect("/dashboard");
}
