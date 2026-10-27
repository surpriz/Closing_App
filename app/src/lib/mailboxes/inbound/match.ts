import { emailDomain } from "@/lib/closing/committee/reader-map";
import { isAutoReply } from "@/lib/closing/replies/text";

import type { DsnDetails, InboundMessage } from "../types";

export type MatchContext = {
  mailboxAddress: string;
  teamEmails: string[];
  sentMessageIds: Map<string, { enrollmentId: string; messageId: string }>;
  enrollments: { enrollmentId: string; email: string; lastSentAt: Date }[];
  now: Date;
};

export type MatchResult =
  | { kind: "own_team" }
  | { kind: "bounce"; dsn: DsnDetails }
  | { kind: "auto_reply" }
  | { kind: "reply"; enrollmentId: string; via: "thread" | "address" | "domain"; messageId: string | null }
  | { kind: "unrelated" };

const ADDRESS_WINDOW_MS = 60 * 24 * 3600 * 1000;
const REPLY_SUBJECT = /^\s*(re|réf|ref)\s*:/i;
export function normalizeMessageId(id: string): string {
  return id.trim().replace(/^<|>$/g, "").trim().toLowerCase();
}

/** The seller's side: their mailbox, a teammate, or a colleague at the same company domain. */
function isTeamSide(from: string, ctx: MatchContext) {
  const addresses = [ctx.mailboxAddress, ...ctx.teamEmails].map((e) => e.toLowerCase());
  if (addresses.includes(from)) return true;
  // emailDomain is null for free mail providers: sharing gmail.com says nothing about the company
  const domain = emailDomain(from);
  return domain !== null && addresses.some((e) => emailDomain(e) === domain);
}

/**
 * Decides what an incoming message is, first match wins: a bounce, our own team, an auto-reply,
 * then a real reply found by thread headers, sender address, or sender domain. Pure.
 */
export function matchInbound(message: InboundMessage, ctx: MatchContext): MatchResult {
  const from = message.from.address.toLowerCase();
  // DSN first: a bounce generated on the seller's own domain (mailer-daemon@) would otherwise read as the team
  if (message.isDsn || message.dsn) {
    return {
      kind: "bounce",
      dsn: message.dsn ?? { action: "other", status: null, diagnostic: null, failedRecipient: null, originalMessageId: null },
    };
  }
  if (isTeamSide(from, ctx)) return { kind: "own_team" };
  if (isAutoReply(message.headers, message.subject)) return { kind: "auto_reply" };

  // Thread: the direct parent first, then the rest of the chain, most recent ancestor first
  const ancestors = [message.inReplyTo, ...[...message.references].reverse()];
  for (const id of ancestors) {
    if (!id) continue;
    const sent = ctx.sentMessageIds.get(normalizeMessageId(id));
    if (sent) return { kind: "reply", enrollmentId: sent.enrollmentId, via: "thread", messageId: sent.messageId };
  }

  // Address: only someone we wrote to before this message, and recently enough to be an answer
  const nowMs = ctx.now.getTime();
  const byAddress = ctx.enrollments
    .filter(
      (e) =>
        e.email.toLowerCase() === from &&
        e.lastSentAt < message.date &&
        e.lastSentAt.getTime() > nowMs - ADDRESS_WINDOW_MS,
    )
    .sort((a, b) => b.lastSentAt.getTime() - a.lastSentAt.getTime())[0];
  if (byAddress) return { kind: "reply", enrollmentId: byAddress.enrollmentId, via: "address", messageId: null };

  // Domain: a colleague answering for the prospect. Needs a "Re:" subject, or any company mail would match
  const domain = emailDomain(from);
  if (domain && REPLY_SUBJECT.test(message.subject ?? "")) {
    const byDomain = ctx.enrollments
      .filter((e) => emailDomain(e.email) === domain)
      .sort((a, b) => b.lastSentAt.getTime() - a.lastSentAt.getTime())[0];
    if (byDomain) return { kind: "reply", enrollmentId: byDomain.enrollmentId, via: "domain", messageId: null };
  }
  return { kind: "unrelated" };
}
