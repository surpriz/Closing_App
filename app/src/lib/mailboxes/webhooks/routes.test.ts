import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  jobs: [] as Promise<unknown>[],
  notify: vi.fn(async () => ({ outcome: "connected" })),
  event: vi.fn(async () => ({ action: "none" })),
  ensure: vi.fn(async () => ({ created: 0 })),
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => void h.jobs.push(fn()),
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_WEBHOOK_TOKEN: "good-token-good-token-good-token" }) }));
vi.mock("@/lib/mailboxes/config", () => ({ mailboxWebhooksEnabled: () => true }));
vi.mock("@/lib/mailboxes/gmail/unipile", () => ({ ensureUnipileWebhook: h.ensure }));
vi.mock("./unipile", async () => ({
  ...(await vi.importActual<typeof import("./unipile")>("./unipile")),
  handleUnipileNotify: h.notify,
  handleUnipileEvent: h.event,
}));
vi.stubEnv("ENCRYPTION_KEY", "k".repeat(40));

const { NextRequest } = await import("next/server");
const { notifySignature, unipileHeaderToken } = await import("./unipile-secrets");
const notifyRoute = await import("../../../app/api/webhooks/mailboxes/unipile/notify/route");
const eventRoute = await import("../../../app/api/webhooks/mailboxes/unipile/route");

const TOKEN = "good-token-good-token-good-token";
const post = (path: string, query: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`https://app.test/api/webhooks/mailboxes/unipile${path}?${query}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.jobs.length = 0;
});

describe("notify route", () => {
  const body = { status: "CREATION_SUCCESS", account_id: "acc_1", name: "st1" };

  it("rejects a wrong token, a missing or wrong signature, a signature for another state", async () => {
    expect((await notifyRoute.POST(post("/notify", `token=bad&sig=${notifySignature("st1")}`, body))).status).toBe(401);
    expect((await notifyRoute.POST(post("/notify", `token=${TOKEN}`, body))).status).toBe(401);
    expect((await notifyRoute.POST(post("/notify", `token=${TOKEN}&sig=nope`, body))).status).toBe(401);
    expect((await notifyRoute.POST(post("/notify", `token=${TOKEN}&sig=${notifySignature("other")}`, body))).status).toBe(401);
    expect((await notifyRoute.POST(post("/notify", `token=${TOKEN}&sig=${notifySignature("st1")}`, null))).status).toBe(401);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("answers 200 at once and connects in the background, then registers the webhook", async () => {
    const res = await notifyRoute.POST(post("/notify", `token=${TOKEN}&sig=${notifySignature("st1")}`, body));
    expect(res.status).toBe(200);
    await Promise.all(h.jobs);
    expect(h.notify).toHaveBeenCalledWith(body);
    expect(h.ensure).toHaveBeenCalledTimes(1);
  });

  it("never fails in the background", async () => {
    h.notify.mockRejectedValueOnce(new Error("boom"));
    const res = await notifyRoute.POST(post("/notify", `token=${TOKEN}&sig=${notifySignature("st1")}`, body));
    expect(res.status).toBe(200);
    await expect(Promise.all(h.jobs)).resolves.toBeDefined();
  });
});

describe("event route", () => {
  const good = { "x-clozer-token": unipileHeaderToken() };

  it("rejects a wrong query token or a wrong header", async () => {
    expect((await eventRoute.POST(post("", "token=bad", {}, good))).status).toBe(401);
    expect((await eventRoute.POST(post("", `token=${TOKEN}`, {}, { "x-clozer-token": "bad" }))).status).toBe(401);
    expect((await eventRoute.POST(post("", `token=${TOKEN}`, {}, { "x-clozer-token": TOKEN }))).status).toBe(401);
    expect((await eventRoute.POST(post("", `token=${TOKEN}`, {}))).status).toBe(401);
    expect(h.event).not.toHaveBeenCalled();
  });

  it("answers 202 for an unknown payload and when the handler throws", async () => {
    expect((await eventRoute.POST(post("", `token=${TOKEN}`, { hello: 1 }, good))).status).toBe(202);
    h.event.mockRejectedValueOnce(new Error("db down"));
    expect((await eventRoute.POST(post("", `token=${TOKEN}`, { event: "mail_received" }, good))).status).toBe(202);
  });
});
