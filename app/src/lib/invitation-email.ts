import type { UiLocale } from "@/i18n/locale";
import { getTranslator } from "@/i18n/messages";
import { renderEmail } from "@/lib/email-layout";

/** The email a teammate gets when a manager invites them to the workspace. Pure. */
export function buildInvitationEmail(input: { inviterName: string; workspaceName: string; url: string; locale: UiLocale }) {
  const t = getTranslator(input.locale);
  const subject = t("emails.invitation.subject", { inviter: input.inviterName });
  return {
    subject,
    ...renderEmail({
      locale: input.locale,
      preheader: t("emails.invitation.preheader", { workspace: input.workspaceName }),
      title: subject,
      blocks: [
        { kind: "text", text: t("emails.invitation.body", { workspace: input.workspaceName }) },
        { kind: "button", label: t("emails.invitation.button"), href: input.url },
      ],
      footer: { text: t("emails.invitation.footer") },
    }),
  };
}
