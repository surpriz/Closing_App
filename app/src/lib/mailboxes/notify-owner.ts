import { getPublicAppUrl } from "@/lib/app-origin";
import { HOUR_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";
import { textToHtml } from "@/lib/text-html";

export type MailboxIssue = "auth_revoked" | "policy_bounces" | "send_failed" | "sync_failed";

export const OWNER_NOTIFY_COOLDOWN_MS = 24 * HOUR_MS;

/**
 * One transactional email to the mailbox owner per issue episode (errorNotifiedAt, 24 h). Never throws.
 * Returns whether an email left. Carries no prospect content: only the mailbox and the technical detail.
 */
export async function notifyMailboxOwner(
  mailboxId: string,
  issue: MailboxIssue,
  detail: string | null,
  now = new Date(),
): Promise<boolean> {
  let previous: Date | null = null;
  let reservedAt = false;
  try {
    if (!isEmailConfigured()) return false;
    previous =
      (await prisma.mailbox.findUnique({ where: { id: mailboxId }, select: { errorNotifiedAt: true } }))
        ?.errorNotifiedAt ?? null;
    // The reservation is the lock: a lost race (count 0) means another pass already told the owner
    const reserved = await prisma.mailbox.updateMany({
      where: {
        id: mailboxId,
        OR: [{ errorNotifiedAt: null }, { errorNotifiedAt: { lt: new Date(now.getTime() - OWNER_NOTIFY_COOLDOWN_MS) } }],
      },
      data: { errorNotifiedAt: now },
    });
    if (reserved.count === 0) return false;
    reservedAt = true;

    const mailbox = await prisma.mailbox.findUnique({
      where: { id: mailboxId },
      select: { email: true, user: { select: { email: true, locale: true } } },
    });
    if (!mailbox) return false;

    const t = getNamespaceTranslator(toUiLocale(mailbox.user.locale), "emails.mailbox");
    const values = { mailbox: mailbox.email };
    const url = `${getPublicAppUrl()}/settings#boite`;
    const action = t("action");
    const body = [t(`intro.${issue}`, values), detail ? t("detail", { detail }) : null].filter(Boolean).join("\n\n");
    const text = `${body}\n\n${action}\n${url}`;
    const html = `${textToHtml(body)}<p><a href="${url}">${action}</a></p>`;
    await sendEmail({ to: mailbox.user.email, subject: t(`subject.${issue}`, values), text, html });
    return true;
  } catch (error) {
    console.error(`[mailbox-notify] ${mailboxId} ${issue}`, error);
    // Released so the next pass can tell the owner instead of staying silent for 24 h
    if (reservedAt) {
      try {
        await prisma.mailbox.updateMany({ where: { id: mailboxId, errorNotifiedAt: now }, data: { errorNotifiedAt: previous } });
      } catch {
        // Nothing more to do: the cooldown simply stands
      }
    }
    return false;
  }
}
