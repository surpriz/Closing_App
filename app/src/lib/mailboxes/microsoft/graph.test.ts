import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ MICROSOFT_MAILBOX_CLIENT_ID: "client-id", MICROSOFT_MAILBOX_CLIENT_SECRET: "client-secret" }),
}));
vi.mock("@/lib/crypto", () => ({ encryptSecret: (s: string) => `enc:${s}`, decryptSecret: (s: string) => s.slice(4) }));

const { graphConnector } = await import("./graph");

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const json = (name: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(fixture(name), { status, headers: { "content-type": "application/json", ...headers } });
const empty = (status: number) => new Response(null, { status });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call = { method: string; url: string; headers: Record<string, string>; body: any };
type Route = (call: Call) => Response | undefined;

const parseBody = (s: string) => (s.startsWith("{") ? JSON.parse(s) : s);

function fakeHttp(routes: Route[]) {
  const calls: Call[] = [];
  const http = (async (input: string | URL, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? "GET",
      url: String(input),
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)),
      body: init.body ? parseBody(String(init.body)) : undefined,
    };
    calls.push(call);
    for (const route of routes) {
      const res = route(call);
      if (res) return res;
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { http, calls };
}

const future = () => new Date(Date.now() + 3600_000).toISOString();
const creds = (over = {}) => ({
  v: 1 as const,
  kind: "microsoft" as const,
  refreshToken: "rt-old",
  accessToken: "at-live",
  accessTokenExpiresAt: future(),
  tenantId: null,
  scope: "x",
  ...over,
});
const mailbox = (over = {}) => ({
  id: "mb1",
  provider: "MICROSOFT" as const,
  connector: "GRAPH" as const,
  email: "me@seller.com",
  displayName: null,
  credentials: "",
  ...over,
});
const message = (over = {}) => ({
  to: { address: "jane@target.io", name: "Jane" },
  subject: "Quick question",
  text: "hi",
  html: "<p>hi</p>",
  messageId: "<own@seller.com>",
  idempotencyKey: "idem-1",
  ...over,
});
const opts = (extra = {}) => ({ limit: 2, notBefore: new Date("2026-10-20T00:00:00Z"), signal: new AbortController().signal, ...extra });

describe("send", () => {
  it("creates a draft with x-* headers only, then sends it", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.method === "POST" && c.url.endsWith("/me/messages") ? json("draft.json", 201) : undefined),
      (c) => (c.url.endsWith("/send") ? empty(202) : undefined),
    ]);
    const out = await graphConnector(mailbox(), creds(), { http }).send(
      message({ headers: { "List-Unsubscribe": "<x>", "X-Campaign": "c1" } }),
    );
    expect(out).toEqual({ messageId: "<CAF1234abcd@mail.outlook.example>", providerId: "AAMkAGI2-draft=", threadId: "AAQkAGI2-conv=" });
    const draft = calls[0].body;
    expect(draft.body).toEqual({ contentType: "html", content: "<p>hi</p>" });
    expect(draft.toRecipients[0].emailAddress).toEqual({ address: "jane@target.io", name: "Jane" });
    expect(draft.internetMessageHeaders).toEqual([
      { name: "X-Clozer-Id", value: "idem-1" },
      { name: "X-Campaign", value: "c1" },
    ]);
    expect(calls[0].headers.authorization).toBe("Bearer at-live");
    expect(calls[1].url).toContain("/me/messages/AAMkAGI2-draft%3D/send");
  });

  it("replies through createReply then patches the draft", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.url.endsWith("/createReply") ? json("draft.json", 201) : undefined),
      (c) => (c.method === "PATCH" ? json("draft.json") : undefined),
      (c) => (c.url.endsWith("/send") ? empty(202) : undefined),
    ]);
    const out = await graphConnector(mailbox(), creds(), { http }).send(message({ replyToProviderId: "AAMk-prev=" }));
    expect(calls.map((c) => `${c.method} ${c.url.replace("https://graph.microsoft.com/v1.0", "")}`)).toEqual([
      "POST /me/messages/AAMk-prev%3D/createReply",
      "PATCH /me/messages/AAMkAGI2-draft%3D",
      "POST /me/messages/AAMkAGI2-draft%3D/send",
    ]);
    expect(calls[0].body).toEqual({
      message: {
        toRecipients: [{ emailAddress: { address: "jane@target.io", name: "Jane" } }],
        internetMessageHeaders: [{ name: "X-Clozer-Id", value: "idem-1" }],
      },
    });
    expect(calls[1].body).toEqual({ subject: "Quick question", body: { contentType: "html", content: "<p>hi</p>" } });
    expect(out.threadId).toBe("AAQkAGI2-conv=");
  });

  it("falls back to a fresh draft when the mail being replied to is gone", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.url.endsWith("/createReply") ? new Response(JSON.stringify({ error: { code: "ErrorItemNotFound" } }), { status: 404 }) : undefined),
      (c) => (c.method === "POST" && c.url.endsWith("/me/messages") ? json("draft.json", 201) : undefined),
      (c) => (c.url.endsWith("/send") ? empty(202) : undefined),
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const out = await graphConnector(mailbox(), creds(), { http }).send(message({ replyToProviderId: "gone" }));
    warn.mockRestore();
    expect(out.providerId).toBe("AAMkAGI2-draft=");
    expect(calls[1].body).toMatchObject({ subject: "Quick question", toRecipients: expect.any(Array) });
  });

  it("rejects the message, not the mailbox, on a 400 or 413 while drafting", async () => {
    for (const status of [400, 413]) {
      const { http } = fakeHttp([() => new Response("{}", { status })]);
      await expect(graphConnector(mailbox(), creds(), { http }).send(message())).rejects.toMatchObject({ code: "REJECTED" });
    }
  });

  it("removes the draft when the send is refused and maps quota", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.method === "POST" && c.url.endsWith("/me/messages") ? json("draft.json", 201) : undefined),
      (c) => (c.url.endsWith("/send") ? json("error-quota.json", 403) : undefined),
      (c) => (c.method === "DELETE" ? empty(204) : undefined),
    ]);
    await expect(graphConnector(mailbox(), creds(), { http }).send(message())).rejects.toMatchObject({ code: "QUOTA" });
    expect(calls.at(-1)?.method).toBe("DELETE");
  });

  it("keeps the draft when the send fails with a 5xx or the network", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.method === "POST" && c.url.endsWith("/me/messages") ? json("draft.json", 201) : undefined),
      (c) => (c.url.endsWith("/send") ? new Response("{}", { status: 503 }) : undefined),
    ]);
    await expect(graphConnector(mailbox(), creds(), { http }).send(message())).rejects.toMatchObject({ code: "TRANSIENT" });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("does not duplicate X-Clozer-Id", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.method === "POST" && c.url.endsWith("/me/messages") ? json("draft.json", 201) : undefined),
      (c) => (c.url.endsWith("/send") ? empty(202) : undefined),
    ]);
    await graphConnector(mailbox(), creds(), { http }).send(message({ headers: { "x-clozer-id": "other" } }));
    expect(calls[0].body.internetMessageHeaders).toEqual([{ name: "X-Clozer-Id", value: "idem-1" }]);
  });

  it("maps 429 with Retry-After", async () => {
    const { http } = fakeHttp([() => new Response("{}", { status: 429, headers: { "retry-after": "120" } })]);
    await expect(graphConnector(mailbox(), creds(), { http }).send(message())).rejects.toMatchObject({
      code: "RATE_LIMITED",
      options: { retryAfterMs: 120_000 },
    });
  });
});

describe("tokens", () => {
  it("refreshes a token about to expire first and persists the rotation", async () => {
    const persist = vi.fn(async () => undefined);
    const { http, calls } = fakeHttp([
      (c) => (c.url.includes("oauth2/v2.0/token") ? json("token-refresh.json") : undefined),
      (c) => (c.url.includes("/me?") ? new Response(JSON.stringify({ mail: "Me@Seller.com", userPrincipalName: "me@seller.com", displayName: "Me" })) : undefined),
    ]);
    const stale = creds({ accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    const out = await graphConnector(mailbox(), stale, { http, persistCredentials: persist }).verify();
    expect(out).toEqual({ ok: true, address: "me@seller.com", displayName: "Me" });
    expect(calls[1].headers.authorization).toBe("Bearer at-new");
    expect(persist).toHaveBeenCalledTimes(1);
    const stored = String((persist.mock.calls[0] as unknown[])[0]);
    expect(stored).toContain("rt-new");
  });

  it("refreshes once on a 401 and retries", async () => {
    let first = true;
    const persist = vi.fn(async () => undefined);
    const { http, calls } = fakeHttp([
      (c) => (c.url.includes("oauth2/v2.0/token") ? json("token-refresh.json") : undefined),
      (c) => {
        if (!c.url.includes("/me?")) return undefined;
        if (first) {
          first = false;
          return new Response("{}", { status: 401 });
        }
        return new Response(JSON.stringify({ userPrincipalName: "me@seller.com" }));
      },
    ]);
    const out = await graphConnector(mailbox(), creds(), { http, persistCredentials: persist }).verify();
    expect(out).toMatchObject({ ok: true, address: "me@seller.com" });
    expect(calls).toHaveLength(3);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("gives up with AUTH_REVOKED when the refresh itself is revoked", async () => {
    const { http } = fakeHttp([
      (c) => (c.url.includes("oauth2/v2.0/token") ? json("error-invalid-grant.json", 400) : undefined),
      () => new Response("{}", { status: 401 }),
    ]);
    const out = await graphConnector(mailbox(), creds(), { http }).verify();
    expect(out).toMatchObject({ ok: false, code: "AUTH_REVOKED" });
  });
});

describe("listNewMessages", () => {
  const routes = (): Route[] => [
    (c) => (c.url.includes("$skiptoken=PAGE2") ? json("delta-page2.json") : undefined),
    (c) => (c.url.includes("$deltatoken=DELTA1") ? json("delta-empty.json") : undefined),
    (c) => (c.url.includes("/messages/delta") ? json("delta-page1.json") : undefined),
    (c) => (c.url.includes("AAMkAGI2-msg1%3D?") ? json("message-reply.json") : undefined),
    (c) => (c.url.includes("AAMkAGI2-bounce%3D?") ? json("message-bounce.json") : undefined),
  ];

  it("pages through delta, then hands back the deltaLink", async () => {
    const { http, calls } = fakeHttp(routes());
    const connector = graphConnector(mailbox(), creds(), { http });
    const candidateSenders = new Set(["jane@target.io"]);

    const p1 = await connector.listNewMessages(null, opts({ candidateSenders }));
    expect(p1.hasMore).toBe(true);
    expect(p1.cursor).toContain("$skiptoken=PAGE2");
    expect(calls[0].url).toContain("$select=id,internetMessageId");
    expect(decodeURIComponent(calls[0].url)).toContain("$filter=receivedDateTime ge 2026-10-20T00:00:00.000Z");
    expect(calls[0].headers.Prefer).toContain("odata.maxpagesize=2");
    expect(p1.messages.map((m) => m.id)).toEqual(["AAMkAGI2-msg1=", "AAMkAGI2-newsletter="]);

    const p2 = await connector.listNewMessages(p1.cursor, opts({ candidateSenders }));
    expect(p2.hasMore).toBe(false);
    expect(p2.cursor).toContain("$deltatoken=DELTA1");
    // the removed item is skipped, the bounce is kept
    expect(p2.messages.map((m) => m.id)).toEqual(["AAMkAGI2-bounce="]);

    const p3 = await connector.listNewMessages(p2.cursor, opts());
    expect(p3.messages).toEqual([]);
    expect(p3.cursor).toContain("$deltatoken=DELTA2");
    // only the first call carries the filter
    expect(calls.at(-1)?.url).not.toContain("$filter");
  });

  it("reads headers and body only for candidates", async () => {
    const { http, calls } = fakeHttp(routes());
    const connector = graphConnector(mailbox(), creds(), { http });
    const { messages } = await connector.listNewMessages(null, opts({ candidateSenders: new Set(["jane@target.io"]) }));
    const [reply, news] = messages;
    expect(reply).toMatchObject({
      messageId: "<reply-1@target.io>",
      threadId: "AAQkAGI2-conv=",
      inReplyTo: "<sent-1@seller.com>",
      references: ["<sent-0@seller.com>", "<sent-1@seller.com>"],
      authenticated: true,
      isDsn: false,
      from: { address: "jane@target.io", name: "Jane Doe" },
    });
    expect(reply.textExcerpt).toBe("Sounds interesting, call me tomorrow");
    expect(news.inReplyTo).toBeNull();
    expect(news.headers).toEqual({});
    expect(calls.filter((c) => c.url.includes("internetMessageHeaders"))).toHaveLength(1);
  });

  it("recognises a bounce through its headers and unique body", async () => {
    const { http } = fakeHttp(routes());
    const connector = graphConnector(mailbox(), creds(), { http });
    const { messages } = await connector.listNewMessages("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$skiptoken=PAGE2", opts());
    expect(messages[0].isDsn).toBe(true);
    expect(messages[0].dsn).toMatchObject({ action: "failed", status: "5.1.10", failedRecipient: "ghost@target.io" });
  });

  it("restarts from scratch when the delta token has expired", async () => {
    let gone = true;
    const { http } = fakeHttp([
      (c) => {
        if (!c.url.includes("$deltatoken=OLD")) return undefined;
        gone = false;
        return new Response(JSON.stringify({ error: { code: "SyncStateNotFound" } }), { status: 410 });
      },
      (c) => (c.url.includes("/messages/delta") ? json("delta-empty.json") : undefined),
    ]);
    const connector = graphConnector(mailbox(), creds(), { http });
    const out = await connector.listNewMessages("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=OLD", opts());
    expect(gone).toBe(false);
    expect(out.cursor).toContain("DELTA2");
  });

  it("throws instead of returning a cursor past unprocessed messages when aborted", async () => {
    const { http } = fakeHttp(routes());
    const controller = new AbortController();
    const connector = graphConnector(mailbox(), creds(), { http: (async (...args: Parameters<typeof fetch>) => {
      const res = await http(...args);
      controller.abort();
      return res;
    }) as typeof fetch });
    await expect(connector.listNewMessages(null, { ...opts(), signal: controller.signal })).rejects.toMatchObject({
      code: "TRANSIENT",
      message: "sync aborted",
    });
  });

  it("reads a Exchange NDR sender and a subject-only bounce as candidates", async () => {
    const page = {
      "@odata.deltaLink": "https://graph.microsoft.com/v1.0/x?$deltatoken=D",
      value: [
        { id: "ndr1", from: { emailAddress: { address: `MicrosoftExchange${"a".repeat(32)}@tenant.onmicrosoft.com` } }, subject: "hello" },
        { id: "ndr2", from: { emailAddress: { address: "someone@x.io" } }, subject: "Undeliverable: hi" },
        { id: "plain", from: { emailAddress: { address: "someone@x.io" } }, subject: "hi" },
      ],
    };
    const { http, calls } = fakeHttp([
      (c) => (c.url.includes("/messages/delta") ? new Response(JSON.stringify(page)) : undefined),
      (c) => (c.url.includes("internetMessageHeaders") ? new Response(JSON.stringify({ id: "x" })) : undefined),
    ]);
    await graphConnector(mailbox(), creds(), { http }).listNewMessages(null, opts());
    expect(calls.filter((c) => c.url.includes("internetMessageHeaders")).map((c) => c.url)).toHaveLength(2);
  });

  it("reports an abort before the first page as a coded error", async () => {
    const { http, calls } = fakeHttp(routes());
    const controller = new AbortController();
    controller.abort();
    await expect(graphConnector(mailbox(), creds(), { http }).listNewMessages(null, { ...opts(), signal: controller.signal })).rejects.toMatchObject({
      code: "TRANSIENT",
      message: "sync aborted",
    });
    expect(calls).toHaveLength(0);
  });

  it("never sends the bearer to a foreign host", async () => {
    const { http, calls } = fakeHttp([]);
    await expect(graphConnector(mailbox(), creds(), { http }).listNewMessages("https://evil.example/x", opts())).rejects.toMatchObject({
      code: "TRANSIENT",
    });
    expect(calls).toHaveLength(0);
  });
});

describe("verify address trust (nOAuth)", () => {
  const verifyWith = async (me: object) => {
    const { http } = fakeHttp([(c) => (c.url.includes("/me?") ? new Response(JSON.stringify(me)) : undefined)]);
    return graphConnector(mailbox(), creds(), { http }).verify();
  };
  it("trusts mail found in proxyAddresses", async () => {
    expect(await verifyWith({ mail: "Sales@Corp.com", userPrincipalName: "j@tenant.onmicrosoft.com", proxyAddresses: ["SMTP:sales@corp.com"] })).toMatchObject({ address: "sales@corp.com" });
  });
  it("trusts mail on the UPN domain", async () => {
    expect(await verifyWith({ mail: "a@corp.com", userPrincipalName: "j@corp.com" })).toMatchObject({ address: "a@corp.com" });
  });
  it("falls back to the UPN for a foreign, unowned mail", async () => {
    expect(await verifyWith({ mail: "ceo@victim.com", userPrincipalName: "j@corp.com", proxyAddresses: [] })).toMatchObject({ address: "j@corp.com" });
  });
});

describe("verify address trust, tenants", () => {
  it("refuses a guest UPN", async () => {
    const { http } = fakeHttp([() => new Response(JSON.stringify({ mail: "a@corp.com", userPrincipalName: "a_corp.com#EXT#@t.onmicrosoft.com" }))]);
    expect(await graphConnector(mailbox(), creds(), { http }).verify()).toMatchObject({ ok: false, code: "CONFIG" });
  });
  it("uses mail directly on a personal account and skips proxyAddresses", async () => {
    const { http, calls } = fakeHttp([() => new Response(JSON.stringify({ mail: "Me@outlook.com", userPrincipalName: "me@thirdparty.io" }))]);
    const out = await graphConnector(mailbox(), creds({ tenantId: "9188040d-6c67-4c5b-b112-36a304b66dad" }), { http }).verify();
    expect(out).toMatchObject({ ok: true, address: "me@outlook.com" });
    expect(calls[0].url).not.toContain("proxyAddresses");
  });
  it("survives an empty /me body", async () => {
    const { http } = fakeHttp([() => new Response("null")]);
    expect(await graphConnector(mailbox(), creds(), { http }).verify()).toMatchObject({ ok: false, code: "CONFIG" });
  });
});

describe("getMessage", () => {
  it("reads one message with its headers", async () => {
    const full = { ...JSON.parse(fixture("message-reply.json")), internetMessageId: "<reply-1@target.io>", from: { emailAddress: { address: "jane@target.io" } } };
    const { http } = fakeHttp([() => new Response(JSON.stringify(full))]);
    const m = await graphConnector(mailbox(), creds(), { http }).getMessage!("AAMkAGI2-msg1=");
    expect(m?.inReplyTo).toBe("<sent-1@seller.com>");
  });
  it("returns null when it is gone", async () => {
    const { http } = fakeHttp([]);
    expect(await graphConnector(mailbox(), creds(), { http }).getMessage!("nope")).toBeNull();
  });
});

describe("subscriptions", () => {
  it("subscribes, renews and unsubscribes", async () => {
    const { http, calls } = fakeHttp([
      (c) => (c.method === "POST" && c.url.endsWith("/subscriptions") ? json("subscription.json", 201) : undefined),
      (c) => (c.method === "PATCH" ? json("subscription.json") : undefined),
      (c) => (c.method === "DELETE" ? empty(204) : undefined),
    ]);
    const connector = graphConnector(mailbox({ subscriptionId: "sub-123" }), creds(), { http });
    const sub = await connector.subscribe!({ notificationUrl: "https://app.test/hook?token=t", clientState: "cs" });
    expect(sub.subscriptionId).toBe("sub-123");
    expect(calls[0].body).toMatchObject({
      changeType: "created",
      resource: "/me/mailFolders('inbox')/messages",
      clientState: "cs",
      lifecycleNotificationUrl: "https://app.test/hook?token=t",
    });
    const mins = (Date.parse(calls[0].body.expirationDateTime) - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(4228);
    expect(mins).toBeLessThanOrEqual(4230);
    await connector.renew!("sub-123");
    expect(calls[1].url).toContain("/subscriptions/sub-123");
    await connector.disconnect();
    expect(calls[2].method).toBe("DELETE");
  });
});
