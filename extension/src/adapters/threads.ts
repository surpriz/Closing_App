import { extractEmail } from "@/lib/recipients";

// Replies in the seller's own mailbox, without connecting it: when the seller opens a Gmail thread
// that carries a Clozer link, a later message from someone else is likely the prospect answering.
// The app decides whether that address belongs to the deal. Only who answered leaves the page,
// never what they wrote.

export type ThreadReply = { slug: string; fromEmail: string; fromName: string | null; messageKey: string };

// One message of an open Gmail thread, expanded or folded
const GMAIL_MESSAGE = "[data-legacy-message-id], [data-message-id]";
// The sender's chip in the message header carries the address
const GMAIL_SENDER = ".gD[email], h3 [email], [email]";

function slugOf(href: string, appOrigin: string) {
  try {
    const url = new URL(href);
    if (url.origin !== appOrigin) return null;
    return /^\/v\/([A-Za-z0-9_-]{6,64})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function outermost(elements: HTMLElement[]) {
  return elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
}

function senderOf(message: HTMLElement) {
  const chip = message.querySelector<HTMLElement>(GMAIL_SENDER);
  const email = extractEmail(chip?.getAttribute("email")) ?? extractEmail(chip?.getAttribute("data-hovercard-id"));
  if (!email) return null;
  const name = chip?.getAttribute("name") ?? chip?.textContent?.trim() ?? null;
  return { email: email.toLowerCase(), name: name && name.length < 200 && !name.includes("@") ? name : null };
}

export function findThreadReplies(root: ParentNode, appOrigin: string): ThreadReply[] {
  const messages = outermost(Array.from(root.querySelectorAll<HTMLElement>(GMAIL_MESSAGE)));
  const replies: ThreadReply[] = [];
  let carrier: { slug: string; sender: string } | null = null;

  for (const message of messages) {
    const sender = senderOf(message);
    if (!carrier) {
      // The first message holding a link: the seller's email with the proposal
      const slug = Array.from(message.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((a) => slugOf(a.href, appOrigin))
        .find((s): s is string => !!s);
      if (slug && sender) carrier = { slug, sender: sender.email };
      continue;
    }
    const key = message.getAttribute("data-legacy-message-id") ?? message.getAttribute("data-message-id");
    if (!sender || !key || sender.email === carrier.sender) continue;
    replies.push({ slug: carrier.slug, fromEmail: sender.email, fromName: sender.name, messageKey: key });
  }
  return replies;
}
