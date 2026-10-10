import { buildMailto } from "../followups/mailto";

/**
 * "Envoyer par email" on the share screen: a new message in the seller's own
 * mailbox, link already in it. Pure, safe in client components.
 */

export type Draft = { to: string; subject: string; body: string };

export function shareDraft(input: {
  url: string;
  title: string;
  to?: string | null;
  firstName?: string | null;
  signature?: string | null;
}): Draft {
  const hello = input.firstName ? `Bonjour ${input.firstName},` : "Bonjour,";
  const body = [hello, "", `Voici ${input.title} :`, input.url, "", input.signature?.trim() || ""].join("\n").trimEnd();
  return { to: input.to ?? "", subject: input.title, body };
}

/** Gmail and Outlook on the web open a compose window; anything else gets a mailto. */
export function composeUrl(client: string | null, draft: Draft) {
  const query = (params: Record<string, string>) =>
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

  if (client === "gmail") {
    return `https://mail.google.com/mail/?view=cm&fs=1&${query({ to: draft.to, su: draft.subject, body: draft.body })}`;
  }
  if (client === "outlook_web") {
    return `https://outlook.office.com/mail/deeplink/compose?${query({ to: draft.to, subject: draft.subject, body: draft.body })}`;
  }
  return buildMailto(draft);
}

/** "Marie Martin" → "Marie"; nothing usable when it looks like an address. */
export function firstNameOf(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first && !first.includes("@") ? first : null;
}

const EMAIL_IN_TEXT = /[^\s<>"',;]+@[^\s<>"',;]+\.[^\s<>"',;]+/;

/**
 * The single "Pour qui ?" field: "marie@acme.com", "Marie Martin <marie@acme.com>",
 * "Marie Martin marie@acme.com" or just "Acme". An address makes a contact
 * (who gets the follow-ups); without one the text only names the link.
 */
export function parseShareRecipient(raw: string): { email: string | null; label: string | null } {
  const text = raw.trim().slice(0, 300);
  const email = text.match(EMAIL_IN_TEXT)?.[0].toLowerCase() ?? null;
  const label = (email ? text.replace(EMAIL_IN_TEXT, "") : text)
    .replace(/[<>"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, "")
    .slice(0, 120);
  return { email, label: label || null };
}

/** No mailbox picked yet: a Gmail or Outlook.com address says enough. Work domains get a mailto. */
export function guessMailClient(email: string | null | undefined) {
  const domain = email?.split("@")[1]?.toLowerCase() ?? "";
  if (/^(gmail|googlemail)\.com$/.test(domain)) return "gmail";
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return "outlook_web";
  return null;
}
