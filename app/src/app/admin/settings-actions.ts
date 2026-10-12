"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { blockEmailAddress, findUserByEmail } from "@/lib/admin/accounts";
import type { AdminActionState } from "@/lib/admin/action-state";
import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { isPlatformAdminEmail, normalizeEmail } from "@/lib/platform-admin";
import { requirePlatformAdmin } from "@/lib/session";

/** Who may create an account: open, or invite-only with an allowlist; plus the blocklist. */

const emailSchema = z.email("Adresse email invalide.").transform(normalizeEmail);
const modeSchema = z.enum(["open", "invite_only"]);

function parseEmail(formData: FormData) {
  return emailSchema.safeParse(String(formData.get("email") ?? "").trim());
}

function refresh() {
  revalidatePath("/admin/settings");
}

export async function setSignupMode(formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const mode = modeSchema.safeParse(formData.get("mode"));
  if (!mode.success) return { error: "Mode inconnu." };

  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: { signupMode: mode.data },
    update: { signupMode: mode.data },
  });
  await logAdminAction({ actorId: admin.id, action: "settings.signup_mode", targetType: "settings", metadata: { mode: mode.data } });
  refresh();
  return { ok: true };
}

export async function allowEmail(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const email = parseEmail(formData);
  if (!email.success) return { error: email.error.issues[0]?.message };

  await prisma.allowedEmail.upsert({ where: { email: email.data }, create: { email: email.data }, update: {} });
  await logAdminAction({ actorId: admin.id, action: "settings.allow_email", targetType: "settings", metadata: { email: email.data } });
  refresh();
  return { ok: true };
}

export async function disallowEmail(email: string): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  await prisma.allowedEmail.deleteMany({ where: { email } });
  await logAdminAction({ actorId: admin.id, action: "settings.disallow_email", targetType: "settings", metadata: { email } });
  refresh();
  return { ok: true };
}

// An email with an account is banned from the account page, so the ban and the blocklist stay in step
export async function blockEmail(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  const email = parseEmail(formData);
  if (!email.success) return { error: email.error.issues[0]?.message };
  if (isPlatformAdminEmail(email.data)) return { error: "Le compte admin ne peut pas être bloqué." };
  if (await findUserByEmail(email.data)) return { error: "Un compte existe avec cet email : bannissez-le depuis sa fiche." };
  // Optional here, unlike the account dialogs: blocking a stranger needs no justification
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

  await blockEmailAddress(email.data, reason, admin.id);
  await logAdminAction({
    actorId: admin.id,
    action: "settings.block_email",
    targetType: "settings",
    reason,
    metadata: { email: email.data },
  });
  refresh();
  return { ok: true };
}

export async function unblockEmail(email: string): Promise<AdminActionState> {
  const admin = await requirePlatformAdmin();
  if (await findUserByEmail(email)) return { error: "Un compte existe avec cet email : réactivez-le depuis sa fiche." };

  await prisma.blockedEmail.deleteMany({ where: { email } });
  await logAdminAction({ actorId: admin.id, action: "settings.unblock_email", targetType: "settings", metadata: { email } });
  refresh();
  return { ok: true };
}
