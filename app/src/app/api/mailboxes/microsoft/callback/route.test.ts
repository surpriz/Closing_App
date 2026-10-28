import { describe, expect, it, vi } from "vitest";

const after = vi.fn();
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => after(fn) }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/closing/notify/preferences", () => ({ getSellerPrefs: async () => ({}), sellerTimezone: () => "Europe/Paris" }));
const mailboxFind = vi.fn(async () => ({ subscriptionId: "old-sub" }));
const mailboxUpdate = vi.fn(async () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { mailbox: { findUnique: mailboxFind, update: mailboxUpdate } } }));
vi.mock("@/lib/mailboxes/credentials", () => ({ encodeCredentials: () => "enc" }));
vi.mock("@/lib/mailboxes/connect", () => ({ connectProviderMailbox: async () => ({ ok: true, mailboxId: "mb1" }) }));
vi.mock("@/lib/mailboxes/config", () => ({
  isMicrosoftMailboxConfigured: () => true,
  mailboxWebhooksEnabled: () => true,
  mailboxWebhookUrl: () => "https://app.test/hook",
  oauthCallbackUrl: () => "https://app.test/cb",
}));
vi.mock("@/lib/mailboxes", () => ({ defaultPersist: () => async () => undefined }));
const calls: string[] = [];
const subscribe = vi.fn(async () => {
  calls.push("subscribe");
  return { subscriptionId: "new-sub", expiresAt: new Date() };
});
const unsubscribe = vi.fn(async () => {
  calls.push("unsubscribe");
});
vi.mock("@/lib/mailboxes/microsoft/graph", () => ({
  graphConnector: () => ({ verify: async () => ({ ok: true, address: "me@x.io", displayName: null }), subscribe, unsubscribe }),
}));
vi.mock("@/lib/mailboxes/microsoft/oauth", () => ({
  exchangeCode: async () => ({ accessToken: "a", refreshToken: "r", expiresIn: 3600, scope: "s", tenantId: null }),
}));
vi.mock("@/lib/mailboxes/oauth/state", () => ({
  consumeOauthState: async () => ({ organizationId: "o", userId: "u", provider: "MICROSOFT", codeVerifier: "v", redirectTo: "mb1" }),
}));
vi.mock("@/lib/mailboxes/webhooks/token", () => ({ clientStateFor: () => "cs" }));
vi.mock("@/lib/outreach/flag", () => ({ requireOutreach: async () => ({ user: { id: "u" }, organization: { id: "o" } }) }));

const { GET } = await import("./route");

describe("microsoft callback reconnect", () => {
  it("drops the old subscription and clears the stored id before subscribing", async () => {
    const res = await GET({ nextUrl: new URL("https://app.test/cb?code=c&state=s"), headers: new Headers() } as never);
    expect(res.headers.get("location")).toContain("mailbox=connected");
    await (after.mock.calls[0][0] as () => Promise<void>)();
    expect(unsubscribe).toHaveBeenCalledWith("old-sub");
    expect(mailboxUpdate).toHaveBeenNthCalledWith(1, { where: { id: "mb1" }, data: { subscriptionId: null, subscriptionExpiresAt: null } });
    expect(calls).toEqual(["unsubscribe", "subscribe"]);
    expect(mailboxUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ subscriptionId: "new-sub" }) }));
  });
});
