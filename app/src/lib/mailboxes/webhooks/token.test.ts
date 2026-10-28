import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_WEBHOOK_TOKEN: "good-token-good-token-good-token" }) }));
vi.stubEnv("ENCRYPTION_KEY", "k".repeat(40));

const { hasMailboxWebhookToken, clientStateFor, verifyClientState } = await import("./token");
const req = (query: string) => new Request(`https://app.test/api/webhooks/mailboxes/x${query}`);

describe("hasMailboxWebhookToken", () => {
  it("accepts the right token only", () => {
    expect(hasMailboxWebhookToken(req("?token=good-token-good-token-good-token"))).toBe(true);
    expect(hasMailboxWebhookToken(req("?token=wrong"))).toBe(false);
    expect(hasMailboxWebhookToken(req(""))).toBe(false);
  });

  it("is off when no token is configured", () => {
    expect(hasMailboxWebhookToken(req("?token=x"), {} as never)).toBe(false);
  });
});

describe("client state when the signing secret is broken", () => {
  it("returns false instead of throwing", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "short");
    expect(verifyClientState("mb1", "a".repeat(64))).toBe(false);
    vi.stubEnv("ENCRYPTION_KEY", "k".repeat(40));
  });
});

describe("client state", () => {
  it("is stable per mailbox and verified in constant time", () => {
    const state = clientStateFor("mb1");
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(clientStateFor("mb1")).toBe(state);
    expect(clientStateFor("mb2")).not.toBe(state);
    expect(verifyClientState("mb1", state)).toBe(true);
    expect(verifyClientState("mb2", state)).toBe(false);
    expect(verifyClientState("mb1", null)).toBe(false);
    expect(verifyClientState("mb1", "short")).toBe(false);
  });
});
