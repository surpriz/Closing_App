import { readFileSync } from "node:fs";
import { join } from "node:path";

import PostalMime from "postal-mime";
import { describe, expect, it } from "vitest";

import { dsnFromHeaders, parseDsn } from "./dsn";
import { matchInbound, normalizeMessageId, type MatchContext } from "./match";
import type { InboundMessage } from "../types";

const now = new Date("2026-11-20T12:00:00Z");
const day = 24 * 3600 * 1000;

const ctx: MatchContext = {
  mailboxAddress: "sender@example.com",
  teamEmails: ["sender@example.com", "colleague@example.com"],
  sentMessageIds: new Map([["orig-1@sender.example.com", { enrollmentId: "enr-1", messageId: "msg-1" }]]),
  enrollments: [
    { enrollmentId: "enr-1", email: "paul@example.org", lastSentAt: new Date(now.getTime() - 3 * day) },
    { enrollmentId: "enr-2", email: "paul@example.org", lastSentAt: new Date(now.getTime() - 1 * day) },
    { enrollmentId: "enr-3", email: "old@example.org", lastSentAt: new Date(now.getTime() - 90 * day) },
    { enrollmentId: "enr-4", email: "boss@example.net", lastSentAt: new Date(now.getTime() - 2 * day) },
  ],
  now,
};

const message = (over: Partial<InboundMessage>): InboundMessage => ({
  id: "m",
  messageId: "<x@example.org>",
  inReplyTo: null,
  references: [],
  from: { address: "paul@example.org", name: null },
  to: ["sender@example.com"],
  subject: "Re: hello",
  date: now,
  textExcerpt: null,
  isDsn: false,
  dsn: null,
  headers: {},
  threadId: null,
  ...over,
});

describe("normalizeMessageId", () => {
  it("strips brackets, trims and lowercases", () => {
    expect(normalizeMessageId("  <Orig-1@Sender.Example.com> ")).toBe("orig-1@sender.example.com");
  });
});

describe("matchInbound", () => {
  it("flags the mailbox, a teammate and a same-domain colleague as own_team", () => {
    expect(matchInbound(message({ from: { address: "Sender@example.com", name: null } }), ctx).kind).toBe("own_team");
    expect(matchInbound(message({ from: { address: "colleague@example.com", name: null } }), ctx).kind).toBe("own_team");
    expect(matchInbound(message({ from: { address: "other@example.com", name: null } }), ctx).kind).toBe("own_team");
  });

  it("does not treat a free-mail domain shared with the team as own_team", () => {
    const gmail = { ...ctx, teamEmails: ["me@gmail.com"] };
    expect(matchInbound(message({ from: { address: "someone@gmail.com", name: null } }), gmail).kind).not.toBe("own_team");
  });

  it("returns a bounce with its details", () => {
    const dsn = { action: "failed" as const, status: "5.1.1", diagnostic: null, failedRecipient: null, originalMessageId: null };
    const result = matchInbound(message({ from: { address: "mailer-daemon@example.org", name: null }, isDsn: true, dsn }), ctx);
    expect(result).toEqual({ kind: "bounce", dsn });
  });

  it("keeps a bounce generated on the seller's own domain as a bounce, not own_team", () => {
    const result = matchInbound(message({ from: { address: "mailer-daemon@example.com", name: null }, isDsn: true }), ctx);
    expect(result.kind).toBe("bounce");
  });

  it("bounces win over auto-reply and thread matching", () => {
    const result = matchInbound(
      message({ isDsn: true, inReplyTo: "<orig-1@sender.example.com>", headers: { "auto-submitted": "auto-replied" } }),
      ctx,
    );
    expect(result.kind).toBe("bounce");
  });

  it("detects an auto-reply before thread matching", () => {
    const result = matchInbound(message({ headers: { "auto-submitted": "auto-replied" }, inReplyTo: "<orig-1@sender.example.com>" }), ctx);
    expect(result).toEqual({ kind: "auto_reply" });
  });

  it("matches by In-Reply-To, normalised", () => {
    expect(matchInbound(message({ inReplyTo: "<ORIG-1@sender.example.com>" }), ctx)).toEqual({
      kind: "reply", enrollmentId: "enr-1", via: "thread", messageId: "msg-1",
    });
  });

  it("matches by References when In-Reply-To is unknown", () => {
    const result = matchInbound(message({ inReplyTo: "<unknown@x>", references: ["<orig-1@sender.example.com>", "<other@x>"] }), ctx);
    expect(result).toMatchObject({ kind: "reply", via: "thread", enrollmentId: "enr-1" });
  });

  it("thread beats address", () => {
    const result = matchInbound(message({ inReplyTo: "<orig-1@sender.example.com>" }), ctx);
    expect(result).toMatchObject({ via: "thread", enrollmentId: "enr-1" });
  });

  it("matches by address, most recent send wins", () => {
    expect(matchInbound(message({}), ctx)).toEqual({ kind: "reply", enrollmentId: "enr-2", via: "address", messageId: null });
  });

  it("ignores enrollments sent after the message or more than 60 days ago", () => {
    const early = message({ from: { address: "paul@example.org", name: null }, subject: "hello", date: new Date(now.getTime() - 10 * day) });
    expect(matchInbound(early, ctx).kind).toBe("unrelated");
    const old = message({ from: { address: "old@example.org", name: null }, subject: "hello" });
    expect(matchInbound(old, ctx).kind).toBe("unrelated");
  });

  it("matches a colleague of the prospect by domain when the subject is a Re:", () => {
    const from = { address: "assistant@example.net", name: null };
    expect(matchInbound(message({ from, subject: "RE: proposal" }), ctx)).toEqual({
      kind: "reply", enrollmentId: "enr-4", via: "domain", messageId: null,
    });
    expect(matchInbound(message({ from, subject: "Réf: proposal" }), ctx)).toMatchObject({ via: "domain" });
  });

  it("does not match by domain an enrollment last sent to more than 60 days ago", () => {
    const from = { address: "assistant@example.org", name: null };
    const stale: MatchContext = {
      ...ctx,
      enrollments: [{ enrollmentId: "enr-3", email: "old@example.org", lastSentAt: new Date(now.getTime() - 90 * day) }],
    };
    expect(matchInbound(message({ from, subject: "Re: hello" }), stale).kind).toBe("unrelated");
  });

  it("does not match by domain without a Re: subject", () => {
    expect(matchInbound(message({ from: { address: "assistant@example.net", name: null }, subject: "Invoice" }), ctx).kind).toBe("unrelated");
  });

  it("a prospect reply with 'échec' in the subject is a reply, not a bounce", () => {
    const text = "On regarde ça demain.";
    const from = { address: "paul@example.org", name: null };
    const subject = "Re: échec du test";
    expect(dsnFromHeaders({ from: from.address, subject, headers: {}, text })).toBeNull();
    expect(matchInbound(message({ from, subject, inReplyTo: "<orig-1@sender.example.com>" }), ctx).kind).toBe("reply");
  });

  it("returns unrelated for a stranger", () => {
    expect(matchInbound(message({ from: { address: "x@example.edu", name: null }, subject: "Re: hi" }), ctx).kind).toBe("unrelated");
  });
});

describe("matchInbound with fixtures", () => {
  const load = (name: string) => PostalMime.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

  it("treats the SMTP DSN fixture as a bounce", async () => {
    const email = await load("smtp-dsn-5.1.1.eml");
    const dsn = parseDsn(email);
    const result = matchInbound(message({ from: { address: email.from?.address ?? "", name: null }, isDsn: !!dsn, dsn }), ctx);
    expect(result.kind).toBe("bounce");
  });

  it("matches the references fixture to its thread", async () => {
    const email = await load("reply-with-references.eml");
    const result = matchInbound(
      message({
        from: { address: email.from?.address ?? "", name: null },
        inReplyTo: email.inReplyTo ?? null,
        references: (email.references ?? "").split(/\s+/).filter(Boolean),
        headers: {},
      }),
      { ...ctx, sentMessageIds: new Map([["orig-1008a@sender.example.com", { enrollmentId: "enr-9", messageId: "msg-9" }]]) },
    );
    expect(result).toMatchObject({ kind: "reply", via: "thread", enrollmentId: "enr-9" });
  });

  it("treats the OOO fixture as an auto-reply", async () => {
    const email = await load("auto-reply-ooo.eml");
    const headers = { "auto-submitted": email.headers.find((h) => h.key === "auto-submitted")?.value };
    expect(matchInbound(message({ from: { address: email.from?.address ?? "", name: null }, subject: email.subject ?? null, headers }), ctx).kind).toBe("auto_reply");
  });
});
