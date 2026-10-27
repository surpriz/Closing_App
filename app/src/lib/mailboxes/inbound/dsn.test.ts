import { readFileSync } from "node:fs";
import { join } from "node:path";

import PostalMime from "postal-mime";
import { describe, expect, it } from "vitest";

import { dsnFromHeaders, parseDsn } from "./dsn";

const load = (name: string) => PostalMime.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

describe("parseDsn", () => {
  it("reads a full multipart/report", async () => {
    const dsn = parseDsn(await load("smtp-dsn-5.1.1.eml"));
    expect(dsn).toEqual({
      action: "failed",
      status: "5.1.1",
      diagnostic: expect.stringContaining("User unknown in virtual mailbox table"),
      failedRecipient: "ghost@example.org",
      originalMessageId: "<orig-1001@sender.example.com>",
    });
    expect(dsn?.diagnostic).not.toMatch(/\n/);
  });

  it("reads a Gmail failure notice", async () => {
    const dsn = parseDsn(await load("gmail-dsn-failure.eml"));
    expect(dsn).toMatchObject({ action: "failed", status: "5.1.1", failedRecipient: "nobody@example.org" });
    expect(dsn?.originalMessageId).toBe("<orig-1002@sender.example.com>");
  });

  it("reads an Exchange NDR with 5.1.10 and the rfc822-headers variant", async () => {
    expect(parseDsn(await load("exchange-ndr-5.1.10.eml"))).toMatchObject({
      status: "5.1.10",
      failedRecipient: "gone@example.org",
      originalMessageId: "<orig-1003@sender.example.com>",
    });
    expect(parseDsn(await load("exchange-ndr-5.7.1.eml"))).toMatchObject({
      status: "5.7.1",
      originalMessageId: "<orig-1004@sender.example.com>",
    });
  });

  it("reads delayed and mailbox-full notices", async () => {
    expect(parseDsn(await load("delayed-4.4.7.eml"))).toMatchObject({ action: "delayed", status: "4.4.7" });
    expect(parseDsn(await load("mailbox-full-5.2.2.eml"))).toMatchObject({ action: "failed", status: "5.2.2" });
  });

  it("returns null for an auto-reply and for a human reply", async () => {
    expect(parseDsn(await load("auto-reply-ooo.eml"))).toBeNull();
    expect(parseDsn(await load("reply-with-references.eml"))).toBeNull();
  });

  it("caps the diagnostic at 300 characters", () => {
    const dsn = dsnFromHeaders({
      from: "mailer-daemon@example.org",
      subject: "Undelivered Mail",
      headers: {},
      text: `550 5.1.1 ${"x ".repeat(400)}`,
    });
    expect(dsn?.diagnostic?.length).toBeLessThanOrEqual(300);
  });
});

describe("dsnFromHeaders", () => {
  it("recognises a plain-text bounce without MIME", () => {
    const dsn = dsnFromHeaders({
      from: "MAILER-DAEMON@example.org",
      subject: "Mail delivery failed: returning message to sender",
      headers: { "x-failed-recipients": "Ghost@Example.org" },
      text: "Remote server said:\n550-5.1.1 The email account does not exist.\n",
    });
    expect(dsn).toMatchObject({ action: "failed", status: "5.1.1", failedRecipient: "ghost@example.org" });
  });

  it("keeps a status-less 'user unknown' bounce as action failed with no status", () => {
    const dsn = dsnFromHeaders({ from: "postmaster@example.org", subject: null, headers: {}, text: "User unknown: bob@example.org" });
    expect(dsn).toMatchObject({ action: "failed", status: null, failedRecipient: "bob@example.org" });
  });

  it("falls back to action other without status or action", () => {
    expect(dsnFromHeaders({ from: "mailer-daemon@example.org", subject: "Oops", headers: {}, text: "Something broke" })?.action).toBe("other");
  });

  it("returns null for a normal message", () => {
    expect(dsnFromHeaders({ from: "paul@example.org", subject: "Re: hello", headers: {}, text: "Sounds good" })).toBeNull();
  });
});
