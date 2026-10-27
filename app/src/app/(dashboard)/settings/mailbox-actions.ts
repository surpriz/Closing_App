"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";
import {
  connectImapMailbox,
  detectMailboxFor,
  disconnectMailbox as disconnectMailboxFor,
  recheckMailboxDns,
  updateMailboxCap,
  type MailboxDetection,
} from "@/lib/mailboxes/connect";
import { requireOutreach } from "@/lib/outreach/flag";

export type MailboxFormState = { ok: true } | { error: string } | null;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const hostSchema = z.string().trim().min(1).max(253);
const portSchema = z.coerce.number().int().min(1).max(65535);
// An unchecked checkbox is absent from the form data
const flag = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const connectSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().max(120).optional(),
  imapHost: hostSchema,
  imapPort: portSchema,
  imapSecure: flag,
  smtpHost: hostSchema,
  smtpPort: portSchema,
  smtpSecure: flag,
  user: z.string().trim().max(254).optional(),
  password: z.string().min(1).max(512),
});

export async function detectMailbox(email: string): Promise<MailboxDetection | null> {
  await requireOutreach();
  const parsed = emailSchema.safeParse(email);
  return parsed.success ? detectMailboxFor(parsed.data) : null;
}

export async function connectMailbox(_prev: MailboxFormState, formData: FormData): Promise<MailboxFormState> {
  const { user, organization } = await requireOutreach();
  const t = await getTranslations("settings.mailbox.errors");
  const parsed = connectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("invalid") };
  const v = parsed.data;

  const prefs = await getSellerPrefs(user.id, organization.id);
  const result = await connectImapMailbox({
    organizationId: organization.id,
    userId: user.id,
    email: v.email,
    displayName: v.displayName || null,
    timezone: sellerTimezone(prefs),
    imap: { host: v.imapHost, port: v.imapPort, secure: v.imapSecure },
    smtp: { host: v.smtpHost, port: v.smtpPort, secure: v.smtpSecure },
    password: v.password,
    user: v.user || undefined,
  });
  if (!result.ok) return { error: t(result.code) };

  await logAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "mailbox.connected",
    targetType: "mailbox",
    targetId: result.mailboxId,
    metadata: { email: v.email },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectMailbox(id: string) {
  const { user, organization } = await requireOutreach();
  if (await disconnectMailboxFor(organization.id, user.id, id)) {
    await logAudit({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "mailbox.disconnected",
      targetType: "mailbox",
      targetId: id,
    });
  }
  revalidatePath("/settings");
}

export async function recheckDns(id: string) {
  const { user, organization } = await requireOutreach();
  await recheckMailboxDns(organization.id, user.id, id);
  revalidatePath("/settings");
}

export async function saveMailboxCap(id: string, cap: number) {
  const { user, organization } = await requireOutreach();
  if (!Number.isFinite(cap)) return;
  const saved = await updateMailboxCap(organization.id, user.id, id, cap);
  if (saved) {
    await logAudit({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "mailbox.cap_changed",
      targetType: "mailbox",
      targetId: id,
      metadata: { email: saved.email, cap: saved.cap },
    });
  }
  revalidatePath("/settings");
}
