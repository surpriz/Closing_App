import { sendEmail, textToHtml } from "@/lib/email";

import { unsubscribeOneClickUrl, unsubscribePageUrl } from "./unsubscribe";
import { unsubscribeFooter } from "./unsubscribe/copy";

/**
 * A plain-text email to a prospect, from the seller's side: replies go to the
 * seller, and the unsubscribe footer and one-click header are always there.
 */
export function sendProspectEmail(input: {
  prospect: { id: string; email: string };
  locale: string;
  subject: string;
  body: string;
  /** The seller who created the link. */
  replyTo: string | null | undefined;
}) {
  // Added at send time only: the seller previews the message without it
  const footer = unsubscribeFooter(unsubscribePageUrl(input.prospect.id), input.locale);
  return sendEmail({
    to: input.prospect.email,
    from: process.env.FOLLOWUP_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM,
    replyTo: input.replyTo ?? process.env.FOLLOWUP_EMAIL_REPLY_TO ?? undefined,
    subject: input.subject,
    text: input.body + footer.text,
    html: textToHtml(input.body) + footer.html,
    // One-click unsubscribe, required by Gmail and Yahoo (RFC 8058)
    headers: {
      "List-Unsubscribe": `<${unsubscribeOneClickUrl(input.prospect.id)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
