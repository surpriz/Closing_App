"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";
import { dkimProbeRelayAddress } from "@/lib/closing/replies/inbound";
import { prisma } from "@/lib/db";
import {
  connectImapMailbox,
  detectMailboxFor,
  disconnectMailbox as disconnectMailboxFor,
  recheckMailboxDns,
  updateMailboxCap,
  type MailboxDetection,
} from "@/lib/mailboxes/connect";
import { decodeCredentials } from "@/lib/mailboxes/credentials";
import { requireOutreach } from "@/lib/outreach/flag";
import { consumeLimit } from "@/lib/rate-limit";

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

export type ReconnectDefaults = {
  displayName: string | null;
  user: string;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
};

/**
 * What the reconnect form starts from: the settings the mailbox was connected with, so custom hosts are not replaced by
 * a fresh detection. Only for the owner's own mailbox in ERROR, and never the password.
 */
export async function reconnectDefaults(mailboxId: string): Promise<ReconnectDefaults | null> {
  const { user, organization } = await requireOutreach();
  if (!z.string().min(1).max(64).safeParse(mailboxId).success) return null;
  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: organization.id, status: "ERROR" },
    select: { userId: true, displayName: true, credentials: true },
  });
  if (!mailbox || mailbox.userId !== user.id) return null;
  let credentials;
  try {
    credentials = decodeCredentials(mailbox.credentials);
  } catch {
    // Unreadable (rotated key, old format): the form falls back on detection
    return null;
  }
  if (credentials.kind !== "imap") return null;
  const { imap, smtp } = credentials;
  return {
    displayName: mailbox.displayName,
    user: imap.user,
    imap: { host: imap.host, port: imap.port, secure: imap.secure },
    smtp: { host: smtp.host, port: smtp.port, secure: smtp.secure },
  };
}

export async function connectMailbox(_prev: MailboxFormState, formData: FormData): Promise<MailboxFormState> {
  const { user, organization } = await requireOutreach();
  const t = await getTranslations("settings.mailbox.errors");
  if (!(await consumeLimit("mailboxConnect", await headers(), user.id))) return { error: t("tooMany") };
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

/** Where to send a test email from this mailbox to check its DKIM for real; null when the relay is off. */
export async function getDkimProbeAddress(mailboxId: string): Promise<string | null> {
  const { user, organization } = await requireOutreach();
  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: organization.id, userId: user.id, status: { not: "DISCONNECTED" } },
    select: { id: true },
  });
  return mailbox ? dkimProbeRelayAddress(mailbox.id) : null;
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
