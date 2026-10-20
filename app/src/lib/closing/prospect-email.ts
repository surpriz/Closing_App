import { sendEmail, textToHtml } from "@/lib/email";

import { unsubscribeOneClickUrl, unsubscribePageUrl } from "./unsubscribe";
import { unsubscribeFooter } from "./unsubscribe/copy";

/** The configured sender of prospect emails. */
export function prospectSender() {
  return process.env.FOLLOWUP_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM;
}

// The seller first: a mail app that keeps a single Reply-To keeps theirs. No seller address, no relay alone
function replyAddresses(seller: string | null | undefined, relay: string | null | undefined) {
  if (!seller) return undefined;
  return relay ? [seller, relay] : seller;
}

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
  /** Reply relay address of this follow-up: the prospect's answer reaches the seller and Clozer. */
  replyRelay?: string | null;
  /** Another From than the seller's side, e.g. "Paul via Clozer" for a forward. */
  from?: string;
}) {
  // Added at send time only: the seller previews the message without it
  const footer = unsubscribeFooter(unsubscribePageUrl(input.prospect.id), input.locale);
  return sendEmail({
    to: input.prospect.email,
    from: input.from ?? prospectSender(),
    replyTo: replyAddresses(input.replyTo ?? process.env.FOLLOWUP_EMAIL_REPLY_TO, input.replyRelay),
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
