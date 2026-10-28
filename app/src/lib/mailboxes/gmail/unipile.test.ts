import { beforeEach, describe, expect, it, vi } from "vitest";

import accountCredentials from "./fixtures/account-credentials.json";
import accountOk from "./fixtures/account-ok.json";
import emailOpaque from "./fixtures/email-opaque.json";
import emailRfc from "./fixtures/email-rfc.json";
import hostedLink from "./fixtures/hosted-link.json";
import listPage1 from "./fixtures/list-page-1.json";
import listPage2 from "./fixtures/list-page-2.json";
import sendResponse from "./fixtures/send-response.json";
import webhooksEmpty from "./fixtures/webhooks-empty.json";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    UNIPILE_DSN: "https://api1.unipile.test:13111/",
    UNIPILE_API_KEY: "secret-key",
    MAILBOX_WEBHOOK_TOKEN: "good-token-good-token-good-token",
  }),
}));
vi.stubEnv("ENCRYPTION_KEY", "k".repeat(40));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));

const { notifySignature, unipileHeaderToken } = await import("../webhooks/unipile-secrets");
const { createHostedAuthLink, ensureUnipileWebhook, unipileConnector } = await import("./unipile");

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
let responder: (url: URL, init: RequestInit) => Response;

const http = (async (input: string | URL | Request, init: RequestInit = {}) => {
  calls.push({ url: String(input), init });
  return responder(new URL(String(input)), init);
}) as typeof fetch;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const creds = { v: 1 as const, kind: "unipile" as const, accountId: "acc_1" };
const connector = () => unipileConnector({ email: "me@acme.test", displayName: "Me" }, creds, { http });
const message = {
  to: { address: "anna@target.io", name: "Anna" },
  subject: "Devis",
  text: "t",
  html: "<p>t</p>",
  messageId: "<own@acme.test>",
  replyToProviderId: "prev_1",
  headers: { "List-Unsubscribe": "<https://app.test/u>", "X-Clozer-Id": "e1" },
  idempotencyKey: "idem-1",
};
const listOpts = { limit: 50, notBefore: new Date("2026-10-20T00:00:00Z"), signal: new AbortController().signal };

beforeEach(() => {
  calls.length = 0;
});

describe("send", () => {
  it("posts the multipart mail then reads the RFC Message-ID and thread back", async () => {
    responder = (url) => (url.pathname === "/api/v1/emails" ? json(sendResponse) : json(emailRfc));
    const result = await connector().send(message);
    expect(result).toEqual({ messageId: "<CAF+abc123@mail.gmail.com>", providerId: "gm_prov_1", threadId: "thr_9" });
    const post = calls[0];
    expect(post.url).toBe("https://api1.unipile.test:13111/api/v1/emails");
    expect((post.init.headers as Record<string, string>)["X-API-KEY"]).toBe("secret-key");
    expect((post.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
    const form = post.init.body as FormData;
    expect(form.get("account_id")).toBe("acc_1");
    expect(form.get("to[0][identifier]")).toBe("anna@target.io");
    expect(form.get("reply_to")).toBe("prev_1");
    expect(form.get("custom_headers[0][name]")).toBe("List-Unsubscribe");
    expect(form.get("custom_headers[1][value]")).toBe("e1");
    expect(calls[1].url).toContain("/api/v1/emails/gm_prov_1?account_id=acc_1");
  });

  it("keeps the thread when the provider id is not an RFC Message-ID", async () => {
    responder = (url) => (url.pathname === "/api/v1/emails" ? json(sendResponse) : json(emailOpaque));
    const result = await connector().send(message);
    expect(result.messageId).toBe("<own@acme.test>");
    expect(result.threadId).toBe("thr_9");
    expect(result.providerId).toBe("gm_prov_1");
  });

  it("does not fail a sent mail when the read-back fails", async () => {
    responder = (url) => (url.pathname === "/api/v1/emails" ? json(sendResponse) : json({}, 500));
    const result = await connector().send(message);
    expect(result).toMatchObject({ providerId: "gm_prov_1", threadId: null });
  });
});

describe("error mapping", () => {
  const code = async (status: number, body: unknown = {}, headers: Record<string, string> = {}) => {
    responder = () => json(body, status, headers);
    return connector().send(message).then(
      () => null,
      (e) => e as { code: string; options: { retryAfterMs?: number; detail?: string } },
    );
  };

  it("maps statuses", async () => {
    expect((await code(401))?.code).toBe("CONFIG");
    expect((await code(403))?.code).toBe("CONFIG");
    expect((await code(500))?.code).toBe("TRANSIENT");
    expect((await code(422, { type: "errors/invalid_recipient" }))?.code).toBe("REJECTED");
    expect((await code(409, { type: "errors/disconnected_account" }))?.code).toBe("AUTH_REVOKED");
    expect((await code(401, { type: "errors/expired_credentials" }))?.code).toBe("AUTH_REVOKED");
    expect((await code(403, { type: "errors/insufficient_permissions" }))?.code).toBe("AUTH_REVOKED");
    expect((await code(400, { type: "errors/invalid_recipient_address" }))?.code).toBe("REJECTED");
    expect((await code(400, { type: "errors/invalid_parameters" }))?.code).toBe("CONFIG");
    const limited = await code(429, {}, { "retry-after": "7" });
    expect(limited?.code).toBe("RATE_LIMITED");
    expect(limited?.options.retryAfterMs).toBe(7000);
  });

  it("never leaks the key and maps a network failure to TRANSIENT", async () => {
    const err = await code(500, { detail: "secret-key" });
    expect(JSON.stringify(err)).not.toContain("secret-key");
    expect(String(err?.options.detail)).not.toContain("secret-key");
    responder = () => {
      throw new TypeError("fetch failed");
    };
    const failed = await connector().send(message).catch((e) => e);
    expect(failed.code).toBe("TRANSIENT");
  });
});

describe("listNewMessages", () => {
  it("reads two pages, following the provider cursor then resuming by date", async () => {
    responder = (url) => json(url.searchParams.get("cursor") === "cur_page_2" ? listPage2 : listPage1);
    const first = await connector().listNewMessages(null, listOpts);
    expect(first.hasMore).toBe(true);
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0]).toMatchObject({
      id: "in_1",
      messageId: "<reply-1@target.io>",
      inReplyTo: "<CAF+abc123@mail.gmail.com>",
      threadId: "thr_9",
      from: { address: "anna@target.io", name: "Anna" },
      isDsn: false,
    });
    expect(first.messages[0].headers["authentication-results"]).toContain("dkim=pass");
    const q1 = new URL(calls[0].url).searchParams;
    expect(q1.get("after")).toBe("2026-10-20T00:00:00.000Z");
    expect(q1.get("role")).toBe("inbox");
    expect(q1.get("include_headers")).toBe("true");

    const second = await connector().listNewMessages(first.cursor, listOpts);
    expect(new URL(calls[1].url).searchParams.get("cursor")).toBe("cur_page_2");
    expect(new URL(calls[1].url).searchParams.get("after")).toBe("2026-10-20T00:00:00.000Z");
    expect(second.hasMore).toBe(false);
    expect(second.messages[0].isDsn).toBe(true);
    expect(second.messages[0].dsn?.failedRecipient).toBe("bob@nowhere.test");
    expect(JSON.parse(second.cursor!).after).toBe("2026-10-27T10:30:00.000Z");

    // next poll starts from the date
    responder = () => json({ items: [], cursor: null });
    const third = await connector().listNewMessages(second.cursor, listOpts);
    expect(new URL(calls[2].url).searchParams.get("after")).toBe("2026-10-27T10:30:00.000Z");
    expect(new URL(calls[2].url).searchParams.has("cursor")).toBe(false);
    expect(JSON.parse(third.cursor!).after).toBe("2026-10-27T10:30:00.000Z");
  });

  it("treats a corrupt cursor as never synced", async () => {
    responder = () => json({ items: [] });
    await connector().listNewMessages("not json", listOpts);
    expect(new URL(calls[0].url).searchParams.get("after")).toBe("2026-10-20T00:00:00.000Z");
  });
});

describe("cursor boundary", () => {
  it("ignores items without a valid date and keeps a one hour overlap", async () => {
    responder = () =>
      json({
        items: [
          { id: "a", date: "2026-10-27T10:00:00.000Z", from_attendee: { identifier: "a@b.test" } },
          { id: "b", date: "garbage", from_attendee: { identifier: "a@b.test" } },
          { id: "c", from_attendee: { identifier: "a@b.test" } },
        ],
      });
    const out = await connector().listNewMessages(null, listOpts);
    expect(out.messages).toHaveLength(3);
    expect(JSON.parse(out.cursor!).after).toBe("2026-10-27T09:00:00.000Z");
  });
});

describe("verify and disconnect", () => {
  it("is ok on a healthy account and returns the address", async () => {
    responder = () => json(accountOk);
    expect(await connector().verify()).toEqual({ ok: true, address: "Me@Acme.test", displayName: "Me" });
  });

  it("reports AUTH_REVOKED when credentials are gone", async () => {
    responder = () => json(accountCredentials);
    expect(await connector().verify()).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
  });

  it("reports AUTH_REVOKED for an unknown account and TRANSIENT for an outage", async () => {
    responder = () => json({}, 404);
    expect(await connector().verify()).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
    responder = () => json({}, 503);
    expect(await connector().verify()).toMatchObject({ ok: false, code: "TRANSIENT" });
  });

  it("deletes the account and tolerates one that is already gone", async () => {
    responder = () => json({ object: "AccountDeleted" });
    await connector().disconnect();
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].url).toBe("https://api1.unipile.test:13111/api/v1/accounts/acc_1");
    responder = () => json({}, 404);
    await expect(connector().disconnect()).resolves.toBeUndefined();
  });
});

describe("hosted auth link", () => {
  it("creates a link whose notify url keeps the token in the query", async () => {
    responder = () => json(hostedLink);
    const url = await createHostedAuthLink(
      { stateId: "st1", type: "create", successUrl: "https://app.test/ok", failureUrl: "https://app.test/ko" },
      { http, now: new Date("2026-10-28T10:00:00Z") },
    );
    expect(url).toBe("https://account.unipile.test/auth/abc");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({
      type: "create",
      providers: ["GOOGLE"],
      api_url: "https://api1.unipile.test:13111",
      expiresOn: "2026-10-28T10:15:00.000Z",
      name: "st1",
      success_redirect_url: "https://app.test/ok",
      failure_redirect_url: "https://app.test/ko",
    });
    expect(body.notify_url).toBe(
      `https://app.test/api/webhooks/mailboxes/unipile/notify?token=good-token-good-token-good-token&sig=${notifySignature("st1")}`,
    );
    expect(body.reconnect_account).toBeUndefined();
  });

  it("passes the account to reconnect", async () => {
    responder = () => json(hostedLink);
    await createHostedAuthLink(
      { stateId: "st1", type: "reconnect", reconnectAccountId: "acc_1", successUrl: "a", failureUrl: "b" },
      { http },
    );
    expect(JSON.parse(calls[0].init.body as string).reconnect_account).toBe("acc_1");
  });
});

describe("ensureUnipileWebhook", () => {
  it("registers each source once and is idempotent by request_url", async () => {
    const registered: Record<string, unknown>[] = [];
    responder = (_url, init) => {
      if (init.method === "POST") {
        registered.push(JSON.parse(init.body as string));
        return json({ object: "WebhookCreated", webhook_id: "w" });
      }
      return json(registered.length ? { items: registered } : webhooksEmpty);
    };
    expect(await ensureUnipileWebhook({ http })).toEqual({ created: 2 });
    expect(registered[0]).toMatchObject({
      source: "email",
      events: ["mail_received"],
      headers: [{ key: "x-clozer-token", value: unipileHeaderToken() }],
    });
    expect(await ensureUnipileWebhook({ http })).toEqual({ created: 0 });
    expect(unipileHeaderToken()).not.toContain("good-token");
    expect(JSON.stringify(calls.map((c) => c.url))).not.toContain(unipileHeaderToken());
  });
});
