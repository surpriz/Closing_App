import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    NYLAS_API_URL: "https://api.eu.nylas.com",
    NYLAS_CLIENT_ID: "cid",
    NYLAS_API_KEY: "key-secret",
  }),
}));
vi.mock("../config", () => ({ oauthCallbackUrl: () => "https://app.test/api/mailboxes/gmail/callback" }));

import { MailboxError } from "../errors";
import grantInvalid from "./fixtures/nylas-grant-invalid.json";
import grantValid from "./fixtures/nylas-grant-valid.json";
import listPage1 from "./fixtures/nylas-list-page-1.json";
import listPage2 from "./fixtures/nylas-list-page-2.json";
import messageHeaders from "./fixtures/nylas-message-headers.json";
import sendNoHeaders from "./fixtures/nylas-send-no-headers.json";
import sendWithHeaders from "./fixtures/nylas-send-with-headers.json";
import token from "./fixtures/nylas-token.json";
import { exchangeNylasCode, nylasAuthorizeUrl, nylasConnector } from "./nylas";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const http = vi.fn();
const connector = () =>
  nylasConnector({ email: "jerome@acme.io", displayName: "Jerome" }, { v: 1, kind: "nylas", grantId: "grant-123" }, { http: http as never });
const outbound = {
  to: { address: "bob@corp.com", name: "Bob" },
  subject: "Hello",
  text: "t",
  html: "<p>t</p>",
  messageId: "<own@acme.io>",
  idempotencyKey: "k",
  headers: { "List-Unsubscribe": "<https://x>" },
};

beforeEach(() => http.mockReset());

describe("nylasAuthorizeUrl", () => {
  it("builds the hosted auth URL", () => {
    const url = new URL(nylasAuthorizeUrl({ state: "st1", loginHint: "a@b.io" }));
    expect(url.origin + url.pathname).toBe("https://api.eu.nylas.com/v3/connect/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "cid",
      redirect_uri: "https://app.test/api/mailboxes/gmail/callback",
      response_type: "code",
      provider: "google",
      access_type: "offline",
      state: "st1",
      login_hint: "a@b.io",
    });
  });
});

describe("exchangeNylasCode", () => {
  it("posts the code and returns the grant", async () => {
    http.mockResolvedValue(json(token));
    expect(await exchangeNylasCode("code1", { http: http as never })).toEqual({ grantId: "grant-123", email: "jerome@acme.io" });
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://api.eu.nylas.com/v3/connect/token");
    expect(JSON.parse(init.body)).toMatchObject({ code: "code1", client_secret: "key-secret", grant_type: "authorization_code" });
  });
  it("maps a rejected code", async () => {
    http.mockResolvedValue(json({ error: { message: "bad code" } }, 400));
    await expect(exchangeNylasCode("x", { http: http as never })).rejects.toMatchObject({ code: "REJECTED" });
  });
});

describe("send", () => {
  it("uses the Message-ID of the response", async () => {
    http.mockResolvedValue(json(sendWithHeaders));
    const result = await connector().send({ ...outbound, replyToProviderId: "prev" });
    expect(result).toEqual({ messageId: "<abc123@mail.gmail.com>", providerId: "msg-1", threadId: "thr-1" });
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://api.eu.nylas.com/v3/grants/grant-123/messages/send");
    expect(init.headers.Authorization).toBe("Bearer key-secret");
    expect(JSON.parse(init.body)).toMatchObject({
      to: [{ email: "bob@corp.com", name: "Bob" }],
      body: "<p>t</p>",
      reply_to_message_id: "prev",
      custom_headers: [{ name: "List-Unsubscribe", value: "<https://x>" }],
    });
  });
  it("reads the Message-ID back when the response has no headers", async () => {
    http.mockResolvedValueOnce(json(sendNoHeaders)).mockResolvedValueOnce(json(messageHeaders));
    const result = await connector().send(outbound);
    expect(result.messageId).toBe("<def456@mail.gmail.com>");
    expect(http.mock.calls[1][0]).toBe("https://api.eu.nylas.com/v3/grants/grant-123/messages/msg-2?fields=include_headers");
  });
  it("falls back on our id when the read-back fails, the mail has left", async () => {
    http.mockResolvedValueOnce(json(sendNoHeaders)).mockResolvedValueOnce(json({}, 500));
    expect((await connector().send(outbound)).messageId).toBe("<own@acme.io>");
  });
  it("translates errors", async () => {
    http.mockResolvedValueOnce(json({}, 401));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "AUTH_REVOKED" });
    http.mockResolvedValueOnce(json({}, 429, { "retry-after": "30" }));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "RATE_LIMITED", options: { retryAfterMs: 30_000 } });
    http.mockResolvedValueOnce(json({}, 503));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "TRANSIENT" });
    http.mockResolvedValueOnce(json({ error: { message: "invalid recipient" } }, 400));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "REJECTED" });
    http.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(connector().send(outbound)).rejects.toBeInstanceOf(MailboxError);
  });
});

describe("error mapping by scope", () => {
  it("a missing reply target on send is REJECTED, not a revoked login", async () => {
    http.mockResolvedValueOnce(json({ error: { type: "not_found_error", message: "Message not found" } }, 404));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "REJECTED", options: { detail: "Message not found" } });
  });
  it("403 on a send is CONFIG, unless it names the grant", async () => {
    http.mockResolvedValueOnce(json({ error: { message: "forbidden" } }, 403));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "CONFIG" });
    http.mockResolvedValueOnce(json({ error: { message: "grant has been revoked" } }, 403));
    await expect(connector().send(outbound)).rejects.toMatchObject({ code: "AUTH_REVOKED" });
  });
  it("404 on the grant itself is AUTH_REVOKED", async () => {
    http.mockResolvedValue(json({}, 404));
    expect(await connector().verify()).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
  });
});

describe("listNewMessages", () => {
  const opts = { limit: 50, notBefore: new Date(1792000000_000), signal: new AbortController().signal };
  it("pages through two responses and ends on a date cursor", async () => {
    http.mockResolvedValueOnce(json(listPage1)).mockResolvedValueOnce(json(listPage2));
    const first = await connector().listNewMessages(null, opts);
    expect(first.hasMore).toBe(true);
    expect(first.cursor).toBe("page:1792000000:1793000000:tok-2");
    const query = new URL(http.mock.calls[0][0]).searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ in: "INBOX", received_after: "1792000000", limit: "50", fields: "include_headers" });
    const [reply] = first.messages;
    expect(reply).toMatchObject({
      id: "m1",
      messageId: "<r1@corp.com>",
      inReplyTo: "<abc123@mail.gmail.com>",
      references: ["<x@y.z>", "<abc123@mail.gmail.com>"],
      from: { address: "alice@corp.com", name: "Alice" },
      threadId: "t1",
      isDsn: false,
      authenticated: true,
    });
    expect(reply.date).toEqual(new Date(1793000000_000));
    expect(reply.headers).not.toHaveProperty("x-other");

    const second = await connector().listNewMessages(first.cursor, opts);
    expect(new URL(http.mock.calls[1][0]).searchParams.get("page_token")).toBe("tok-2");
    expect(second.hasMore).toBe(false);
    expect(second.cursor).toBe("date:1793000499");
    expect(second.messages[0].isDsn).toBe(true);
    expect(second.messages[0].dsn?.failedRecipient).toBe("nobody@corp.com");
  });
  it("resumes from a date cursor", async () => {
    http.mockResolvedValue(json({ data: [] }));
    const res = await connector().listNewMessages("date:1793000500", opts);
    expect(new URL(http.mock.calls[0][0]).searchParams.get("received_after")).toBe("1793000500");
    expect(res.cursor).toBe("date:1793000500");
  });
});

describe("verify / disconnect", () => {
  it("accepts a valid grant", async () => {
    http.mockResolvedValue(json(grantValid));
    expect(await connector().verify()).toEqual({ ok: true, address: "jerome@acme.io", displayName: "Jerome" });
  });
  it("flags an invalid grant as AUTH_REVOKED", async () => {
    http.mockResolvedValue(json(grantInvalid));
    expect(await connector().verify()).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
  });
  it("flags a 401 as AUTH_REVOKED", async () => {
    http.mockResolvedValue(json({}, 401));
    expect(await connector().verify()).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
  });
  it("deletes the grant", async () => {
    http.mockResolvedValue(json({}));
    await connector().disconnect();
    expect(http.mock.calls[0][1].method).toBe("DELETE");
    expect(http.mock.calls[0][0]).toBe("https://api.eu.nylas.com/v3/grants/grant-123");
  });
});
