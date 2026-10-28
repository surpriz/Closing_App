import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = { mailbox: { findFirst: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));
vi.mock("@/lib/outreach/flag", () => ({
  requireOutreach: async () => ({ user: { id: "u1" }, organization: { id: "o1" } }),
}));
vi.mock("@/lib/rate-limit", () => ({ consumeLimit: async () => true, tooManyRequests: () => new Response(null, { status: 429 }) }));
const gmailConnector = vi.fn();
vi.mock("@/lib/mailboxes/config", () => ({ gmailConnector: () => gmailConnector() }));
const createOauthState = vi.fn();
vi.mock("@/lib/mailboxes/oauth/state", () => ({ createOauthState: (...a: unknown[]) => createOauthState(...a) }));
const nylasAuthorizeUrl = vi.fn();
vi.mock("@/lib/mailboxes/gmail/nylas", () => ({ nylasAuthorizeUrl: (...a: unknown[]) => nylasAuthorizeUrl(...a) }));
const createHostedAuthLink = vi.fn();
vi.mock("@/lib/mailboxes/gmail/unipile", () => ({ createHostedAuthLink: (...a: unknown[]) => createHostedAuthLink(...a) }));

const { GET } = await import("./route");

const get = (query = "") => {
  const url = new URL(`https://app.test/api/mailboxes/gmail/start${query}`);
  return GET({ url: url.toString(), nextUrl: url, headers: new Headers() } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  gmailConnector.mockReturnValue("UNIPILE");
  createOauthState.mockResolvedValue({ id: "st1" });
  createHostedAuthLink.mockResolvedValue("https://hosted.test/x");
  nylasAuthorizeUrl.mockReturnValue("https://nylas.test/auth");
});

describe("gmail start", () => {
  it("starts a new Unipile connection", async () => {
    const res = await get();
    expect(res.headers.get("location")).toBe("https://hosted.test/x");
    expect(createOauthState).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: null, provider: "GOOGLE" }));
    expect(createHostedAuthLink).toHaveBeenCalledWith(expect.objectContaining({ type: "create" }));
  });

  it("refuses a malformed or foreign mailboxId without creating a state", async () => {
    expect((await get("?mailboxId=a%20b")).headers.get("location")).toContain("mailbox=error");
    prisma.mailbox.findFirst.mockResolvedValue(null);
    expect((await get("?mailboxId=other")).headers.get("location")).toContain("mailbox=error");
    expect(prisma.mailbox.findFirst.mock.calls[0][0].where).toEqual({
      id: "other",
      organizationId: "o1",
      userId: "u1",
      provider: "GOOGLE",
    });
    expect(createOauthState).not.toHaveBeenCalled();
  });

  it("reconnects an Unipile mailbox through its account", async () => {
    prisma.mailbox.findFirst.mockResolvedValue({ id: "mb1", email: "a@b.io", externalAccountId: "acc1" });
    await get("?mailboxId=mb1");
    expect(createOauthState).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: "mb1" }));
    expect(createHostedAuthLink).toHaveBeenCalledWith(expect.objectContaining({ type: "reconnect", reconnectAccountId: "acc1" }));
  });

  it("reconnects a Nylas mailbox with its address as hint", async () => {
    gmailConnector.mockReturnValue("NYLAS");
    prisma.mailbox.findFirst.mockResolvedValue({ id: "mb1", email: "a@b.io", externalAccountId: "g1" });
    const res = await get("?mailboxId=mb1&login_hint=x%40y.io");
    expect(res.headers.get("location")).toBe("https://nylas.test/auth");
    expect(nylasAuthorizeUrl).toHaveBeenCalledWith({ state: "st1", loginHint: "a@b.io" });
    expect(createOauthState).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: "mb1" }));
  });

  it("forwards a valid login_hint to Nylas and drops an invalid one", async () => {
    gmailConnector.mockReturnValue("NYLAS");
    await get("?login_hint=me%40acme.io");
    expect(nylasAuthorizeUrl).toHaveBeenLastCalledWith({ state: "st1", loginHint: "me@acme.io" });
    await get("?login_hint=not-an-email");
    expect(nylasAuthorizeUrl).toHaveBeenLastCalledWith({ state: "st1", loginHint: null });
  });
});
