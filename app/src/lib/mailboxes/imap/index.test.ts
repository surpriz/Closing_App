import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ imapOptions: [] as unknown[] }));
const sendMail = vi.fn();
const verifyTransport = vi.fn();
const close = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail, verify: verifyTransport, close })) },
}));

const state = { uidValidity: BigInt(10), search: [] as number[], messages: [] as unknown[] };
const logout = vi.fn(async () => {});
const download = vi.fn(async () => ({ meta: { charset: "utf-8" }, content: Readable.from([Buffer.from("Merci, ok.")]) }));
vi.mock("imapflow", () => ({
  ImapFlow: class {
    constructor(options: unknown) {
      h.imapOptions.push(options);
    }
    on() {}
    async connect() {}
    async mailboxOpen() {
      return { uidValidity: state.uidValidity };
    }
    search = vi.fn(async () => state.search);
    fetchAll = vi.fn(async () => state.messages);
    download = download;
    logout = logout;
    close() {}
  },
}));

import nodemailer from "nodemailer";

import { MailboxError } from "../errors";
import { mapImapError } from "./imap";
import { imapConnector } from "./index";

const creds = {
  v: 1 as const,
  kind: "imap" as const,
  imap: { host: "imap.x.fr", port: 993, secure: true, user: "u", pass: "p" },
  smtp: { host: "smtp.x.fr", port: 465, secure: true, user: "u", pass: "p" },
};
const connector = () => imapConnector({ email: "me@x.fr", displayName: "Me" }, creds);

beforeEach(() => {
  vi.clearAllMocks();
  state.uidValidity = BigInt(10);
  state.search = [];
  state.messages = [];
  h.imapOptions.length = 0;
});

describe("imapConnector.send", () => {
  it("passes our ids and headers through to sendMail", async () => {
    sendMail.mockResolvedValue({});
    const result = await connector().send({
      to: { address: "a@b.fr" },
      subject: "Hi",
      text: "t",
      html: "<p>t</p>",
      messageId: "<m1@x.fr>",
      inReplyTo: "<p@x.fr>",
      references: ["<p@x.fr>"],
      headers: { "List-Unsubscribe": "<mailto:u@x.fr>" },
      idempotencyKey: "k",
    });
    expect(result).toEqual({ messageId: "<m1@x.fr>", providerId: null, threadId: null });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "<m1@x.fr>",
        inReplyTo: "<p@x.fr>",
        references: ["<p@x.fr>"],
        headers: { "List-Unsubscribe": "<mailto:u@x.fr>" },
        from: { address: "me@x.fr", name: "Me" },
      }),
    );
  });

  it.each([
    [{ code: "EAUTH" }, "AUTH_REVOKED"],
    [{ responseCode: 535 }, "AUTH_REVOKED"],
    [{ responseCode: 451, response: "451 try later" }, "TRANSIENT"],
    [{ responseCode: 421, response: "421 too many connections" }, "RATE_LIMITED"],
    [{ responseCode: 552, response: "552 mailbox quota exceeded" }, "QUOTA"],
    [{ responseCode: 550, response: "550 no such user\nmore" }, "REJECTED"],
    // Network failures are retried later, never a configuration error that would put the mailbox in ERROR
    [{ code: "ETIMEDOUT" }, "TRANSIENT"],
    [{ code: "ECONNRESET" }, "TRANSIENT"],
    [{ code: "EPIPE" }, "TRANSIENT"],
    [{ code: "ENOTFOUND" }, "TRANSIENT"],
  ])("maps %j to %s", async (failure, code) => {
    sendMail.mockRejectedValue(Object.assign(new Error("boom"), failure));
    const err = await connector()
      .send({ to: { address: "a@b.fr" }, subject: "s", text: "t", html: "t", messageId: "<m@x>", idempotencyKey: "k" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(MailboxError);
    expect(err.code).toBe(code);
  });

  it("keeps the first response line as detail on a rejection", async () => {
    sendMail.mockRejectedValue(Object.assign(new Error("x"), { responseCode: 550, response: "550 no such user\nmore" }));
    const err = await connector()
      .send({ to: { address: "a@b.fr" }, subject: "s", text: "t", html: "t", messageId: "<m@x>", idempotencyKey: "k" })
      .catch((e) => e);
    expect(err.options.detail).toBe("550 no such user");
  });
});

describe("imapConnector.verify", () => {
  it("reports an SMTP auth failure without throwing", async () => {
    verifyTransport.mockRejectedValue(Object.assign(new Error("bad"), { code: "EAUTH" }));
    expect(await connector().verify()).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
  });
});

describe("imapConnector.listNewMessages", () => {
  const opts = () => ({ limit: 10, notBefore: new Date("2026-01-01"), signal: new AbortController().signal });
  const msg = (uid: number, extra: Record<string, unknown> = {}) => ({
    uid,
    envelope: { from: [{ address: "P@Acme.com", name: "P" }], to: [{ address: "me@x.fr" }], subject: "Re: devis", ...extra },
    headers: Buffer.from("References: <a@x> <b@x>\r\n"),
    bodyStructure: { type: "text/plain", part: "1" },
  });

  it("resets the cursor when uidValidity changed and returns the new one", async () => {
    state.uidValidity = BigInt(11);
    state.search = [];
    const res = await connector().listNewMessages(JSON.stringify({ uidValidity: 10, lastUid: 99 }), opts());
    expect(JSON.parse(res.cursor!)).toEqual({ uidValidity: 11, lastUid: 0 });
  });

  it("ignores the already-seen UID that '*' always matches and downloads a reply excerpt", async () => {
    state.search = [5, 6];
    state.messages = [msg(6, { inReplyTo: "<a@x>" })];
    const res = await connector().listNewMessages(JSON.stringify({ uidValidity: 10, lastUid: 5 }), opts());
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0]).toMatchObject({
      id: "10:6",
      references: ["<a@x>", "<b@x>"],
      from: { address: "p@acme.com" },
      textExcerpt: "Merci, ok.",
      isDsn: false,
    });
    expect(JSON.parse(res.cursor!).lastUid).toBe(6);
    expect(res.hasMore).toBe(false);
    expect(logout).toHaveBeenCalled();
  });

  it("skips the body of messages that are not candidates and flags hasMore", async () => {
    state.search = [1, 2, 3];
    state.messages = [
      { uid: 1, envelope: { from: [{ address: "x@y.com" }], subject: "newsletter" }, headers: Buffer.from("") },
    ];
    const res = await connector().listNewMessages(null, { ...opts(), limit: 1 });
    expect(res.messages[0].textExcerpt).toBeNull();
    expect(download).not.toHaveBeenCalled();
    expect(res.hasMore).toBe(true);
  });
});

describe("transport security options", () => {
  const send = () =>
    connector().send({ to: { address: "a@b.fr" }, subject: "s", text: "t", html: "t", messageId: "<m@x>", idempotencyKey: "k" });

  it("requires STARTTLS on SMTP and IMAP when the connection is not implicit TLS", async () => {
    sendMail.mockResolvedValue({});
    const plain = { ...creds, smtp: { ...creds.smtp, port: 587, secure: false }, imap: { ...creds.imap, port: 143, secure: false } };
    const c = imapConnector({ email: "me@x.fr", displayName: null }, plain);
    await c.send({ to: { address: "a@b.fr" }, subject: "s", text: "t", html: "t", messageId: "<m@x>", idempotencyKey: "k" });
    expect(vi.mocked(nodemailer.createTransport).mock.calls.at(-1)?.[0] as unknown).toMatchObject({ secure: false, requireTLS: true });
    await c.listNewMessages(null, { limit: 1, notBefore: new Date(), signal: new AbortController().signal });
    expect(h.imapOptions[0]).toMatchObject({ secure: false, doSTARTTLS: true });
  });

  it("does not weaken certificate checks", async () => {
    sendMail.mockResolvedValue({});
    await send();
    expect(JSON.stringify(vi.mocked(nodemailer.createTransport).mock.calls.at(-1)?.[0] as unknown)).not.toContain("rejectUnauthorized");
  });

  it("refuses a forbidden port or private literal before connecting", async () => {
    const bad = { ...creds, smtp: { ...creds.smtp, host: "10.0.0.5" } };
    await expect(
      imapConnector({ email: "me@x.fr", displayName: null }, bad).send({
        to: { address: "a@b.fr" }, subject: "s", text: "t", html: "t", messageId: "<m@x>", idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ code: "CONFIG" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("mapImapError", () => {
  it.each(["ETIMEDOUT", "ECONNRESET", "ESOCKET", "EDNS", "ECONNREFUSED", "EHOSTUNREACH", "ENOTFOUND", "EPIPE"])(
    "maps %s to TRANSIENT",
    (code) => {
      expect(mapImapError(Object.assign(new Error("x"), { code })).code).toBe("TRANSIENT");
    },
  );

  it("keeps a refused login as AUTH_REVOKED", () => {
    expect(mapImapError({ authenticationFailed: true }).code).toBe("AUTH_REVOKED");
  });
});

describe("poison messages", () => {
  it("degrades a message whose download fails and still advances the cursor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.search = [1, 2];
    const m = (uid: number) => ({
      uid,
      envelope: { from: [{ address: "p@acme.com" }], subject: "Re: x", inReplyTo: "<a@x>" },
      headers: Buffer.from(""),
      bodyStructure: { type: "text/plain", part: "1" },
    });
    state.messages = [m(1), m(2)];
    download.mockRejectedValueOnce(new Error("boom"));
    const res = await connector().listNewMessages(null, { limit: 10, notBefore: new Date(), signal: new AbortController().signal });
    expect(res.messages.map((x) => x.textExcerpt)).toEqual([null, "Merci, ok."]);
    expect(JSON.parse(res.cursor!).lastUid).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
