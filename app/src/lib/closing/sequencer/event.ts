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
 * common case of a "lead replied" automation. "ignored" for an event Clozer
 * does not act on, null when there is no address. Pure.
 */
export function parseSequencerEvent(
  body: Body | null,
  query: URLSearchParams,
): SequencerEvent | "ignored" | null {
  // Never "to" or "recipient": on a reply those are the seller's own address
  const rawEmail =
    pick(body, "email", "lead.email", "contact.email", "lead_email", "leadEmail", "from") ?? query.get("email");
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (!email) return null;
  const rawKind = (pick(body, "event", "type", "event_type", "eventType") ?? query.get("event") ?? "replied")
    .toLowerCase()
    .replace(/[\s-]/g, "_");
  const kind = KINDS[rawKind];
  // Opened, clicked, sent…: tools often post every event to one address, those are no error
  if (!kind) return "ignored";
  const excerpt = pick(body, "text", "reply", "message", "body", "reply_text", "replyText");
  return { email, kind, excerpt: excerpt ? excerpt.slice(0, 600) : null };
}

function sign(organizationId: string, version: number, secret: string) {
  return createHmac("sha256", secret).update(`sequencer:${organizationId}:${version}`).digest("base64url");
}

/**
 * The workspace's webhook address token: the workspace id and a version, signed. Never stored;
 * bumping the version (WorkspaceSettings.sequencerTokenVersion) revokes every address given out.
 */
export function sequencerToken(organizationId: string, version: number, secret: string) {
  return `${organizationId}.${version}.${sign(organizationId, version, secret)}`;
}

/** The workspace and version the token was signed for; the caller checks the version is current. */
export function verifySequencerToken(token: string, secret: string): { organizationId: string; version: number } | null {
  const [organizationId, rawVersion, signature, ...rest] = token.split(".");
  const version = Number(rawVersion);
  if (!organizationId || !signature || rest.length > 0 || !Number.isInteger(version) || version < 0) return null;
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(organizationId, version, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { organizationId, version };
}
