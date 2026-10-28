import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeEmail } from "../prospects/from-recipient";

/**
 * What a cold email tool (Lemlist, Manyreach…, or Zapier / Make in between)
 * reports about a Smart Link prospect: they answered, unsubscribed or bounced.
 * Clozer cannot see those emails: they come and go through the seller's own
 * mailbox, never through Clozer.
 */
export type SequencerEventKind = "replied" | "unsubscribed" | "bounced";
export type SequencerEvent = { email: string; kind: SequencerEventKind; excerpt: string | null };

const KINDS: Record<string, SequencerEventKind> = {
  reply: "replied",
  replied: "replied",
  email_replied: "replied",
  lead_replied: "replied",
  emailsreplied: "replied",
  unsubscribe: "unsubscribed",
  unsubscribed: "unsubscribed",
  opt_out: "unsubscribed",
  optout: "unsubscribed",
  emailsunsubscribed: "unsubscribed",
  bounce: "bounced",
  bounced: "bounced",
  hard_bounce: "bounced",
  emailsbounced: "bounced",
};

type Body = Record<string, unknown>;

function pick(source: Body | null | undefined, ...paths: string[]): string | null {
  for (const path of paths) {
    let value: unknown = source;
    for (const key of path.split(".")) value = value && typeof value === "object" ? (value as Body)[key] : undefined;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Reads the tools' usual shapes: `{ email, event }` as documented, plus the
 * nested lead or contact objects most tools post. No event means a reply, the
 * common case of a "lead replied" automation. Null when there is no address
 * or the event is not one Clozer acts on. Pure.
 */
export function parseSequencerEvent(body: Body | null, query: URLSearchParams): SequencerEvent | null {
  const rawEmail =
    pick(body, "email", "lead.email", "contact.email", "lead_email", "leadEmail", "recipient", "to") ?? query.get("email");
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (!email) return null;
  const rawKind = (pick(body, "event", "type", "event_type", "eventType") ?? query.get("event") ?? "replied")
    .toLowerCase()
    .replace(/[\s-]/g, "_");
  const kind = KINDS[rawKind];
  if (!kind) return null;
  const excerpt = pick(body, "text", "reply", "message", "body", "reply_text", "replyText");
  return { email, kind, excerpt: excerpt ? excerpt.slice(0, 600) : null };
}

function sign(organizationId: string, secret: string) {
  return createHmac("sha256", secret).update(`sequencer:${organizationId}`).digest("base64url");
}

/** The workspace's webhook address token: the workspace id, signed. Never stored, never rotated. */
export function sequencerToken(organizationId: string, secret: string) {
  return `${organizationId}.${sign(organizationId, secret)}`;
}

export function verifySequencerToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const organizationId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(organizationId, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return organizationId;
}
