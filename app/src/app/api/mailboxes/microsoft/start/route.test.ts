import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = { mailbox: { findFirst: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MICROSOFT_MAILBOX_CLIENT_ID: "client-id", MICROSOFT_MAILBOX_CLIENT_SECRET: "secret" }) }));
vi.mock("@/lib/outreach/flag", () => ({
  requireOutreach: async () => ({ user: { id: "u1" }, organization: { id: "o1" } }),
}));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));
const canUseMailboxes = vi.fn(async () => true);
vi.mock("@/lib/billing/mailboxes", () => ({ canUseMailboxes: () => canUseMailboxes() }));
const consumeLimit = vi.fn(async () => true);
vi.mock("@/lib/rate-limit", () => ({ consumeLimit: () => consumeLimit(), tooManyRequests: () => new Response(null, { status: 429 }) }));
const configured = vi.fn(() => true);
vi.mock("@/lib/mailboxes/config", () => ({
  isMicrosoftMailboxConfigured: () => configured(),
  oauthCallbackUrl: (provider: string) => `https://app.test/api/mailboxes/${provider}/callback`,
}));
const createOauthState = vi.fn();
vi.mock("@/lib/mailboxes/oauth/state", () => ({ createOauthState: (...a: unknown[]) => createOauthState(...a) }));

const { GET } = await import("./route");

const get = (query = "") => {
  const url = new URL(`https://app.test/api/mailboxes/microsoft/start${query}`);
  return GET({ url: url.toString(), nextUrl: url, headers: new Headers() } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  consumeLimit.mockResolvedValue(true);
  canUseMailboxes.mockResolvedValue(true);
  configured.mockReturnValue(true);
  createOauthState.mockResolvedValue({ id: "st1", codeVerifier: "verifier", codeChallenge: "challenge" });
  prisma.mailbox.findFirst.mockResolvedValue(null);
});

describe("microsoft start", () => {
  it("sends a workspace without the mailbox add-on back to settings, before any state", async () => {
    canUseMailboxes.mockResolvedValue(false);
    const res = await get();
    expect(res.headers.get("location")).toBe("https://app.test/settings?mailbox=error&code=plan#boite");
    expect(createOauthState).not.toHaveBeenCalled();
    expect(consumeLimit).not.toHaveBeenCalled();
  });

  it("lets a reconnection through whatever the plan", async () => {
    canUseMailboxes.mockResolvedValue(false);
    await get("?mailboxId=mb1");
    expect(canUseMailboxes).not.toHaveBeenCalled();
  });

  it("creates a state and sends the seller to Microsoft with PKCE and the mail scopes", async () => {
    const res = await get();
    expect(createOauthState).toHaveBeenCalledWith({ organizationId: "o1", userId: "u1", provider: "MICROSOFT", redirectTo: null });
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(Object.fromEntries(location.searchParams)).toEqual({
      client_id: "client-id",
      response_type: "code",
      redirect_uri: "https://app.test/api/mailboxes/microsoft/callback",
      response_mode: "query",
      scope: "openid email offline_access User.Read Mail.ReadWrite Mail.Send",
      state: "st1",
      code_challenge: "challenge",
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    // The verifier stays server side
    expect(res.headers.get("location")).not.toContain("verifier");
  });

  it("reconnects one of the seller's own mailboxes, with its address as hint", async () => {
    prisma.mailbox.findFirst.mockResolvedValue({ id: "mb1", email: "me@acme.fr" });
    const res = await get("?mailboxId=mb1");
    expect(prisma.mailbox.findFirst.mock.calls[0][0].where).toEqual({ id: "mb1", organizationId: "o1", userId: "u1" });
    expect(createOauthState).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: "mb1" }));
    expect(new URL(res.headers.get("location")!).searchParams.get("login_hint")).toBe("me@acme.fr");
  });

  it("ignores a mailboxId that is malformed or not the seller's: a plain connection", async () => {
    await get("?mailboxId=a%20b");
    expect(prisma.mailbox.findFirst).not.toHaveBeenCalled();
    await get("?mailboxId=other");
    expect(createOauthState).toHaveBeenLastCalledWith(expect.objectContaining({ redirectTo: null }));
  });

  it("answers 429 when rate limited, without creating a state", async () => {
    consumeLimit.mockResolvedValue(false);
    expect((await get()).status).toBe(429);
    expect(createOauthState).not.toHaveBeenCalled();
  });

  it("answers 404 when Microsoft is not configured, without spending the limit", async () => {
    configured.mockReturnValue(false);
    expect((await get()).status).toBe(404);
    expect(consumeLimit).not.toHaveBeenCalled();
    expect(createOauthState).not.toHaveBeenCalled();
  });
});
