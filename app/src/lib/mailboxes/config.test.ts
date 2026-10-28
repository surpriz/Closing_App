import { afterEach, describe, expect, it, vi } from "vitest";

const getEnv = vi.fn();
vi.mock("@/lib/env", () => ({ getEnv: () => getEnv() }));

const { gmailConnector, isMicrosoftMailboxConfigured, mailboxWebhooksEnabled, mailboxWebhookUrl, oauthCallbackUrl } =
  await import("./config");

const unipile = { UNIPILE_DSN: "https://api1.unipile.com:1", UNIPILE_API_KEY: "k" };
const nylas = { NYLAS_CLIENT_ID: "c", NYLAS_API_KEY: "k" };
const env = (over: Record<string, unknown>) => over as never;

afterEach(() => vi.unstubAllEnvs());

describe("gmailConnector", () => {
  it("defaults to unipile, then nylas, else null", () => {
    expect(gmailConnector(env({ ...unipile, ...nylas }))).toBe("UNIPILE");
    expect(gmailConnector(env(nylas))).toBe("NYLAS");
    expect(gmailConnector(env({}))).toBeNull();
    expect(gmailConnector(env({ UNIPILE_DSN: "https://x" }))).toBeNull();
  });

  it("honours GMAIL_CONNECTOR only when that connector is configured", () => {
    expect(gmailConnector(env({ ...unipile, ...nylas, GMAIL_CONNECTOR: "nylas" }))).toBe("NYLAS");
    expect(gmailConnector(env({ ...unipile, GMAIL_CONNECTOR: "nylas" }))).toBeNull();
  });
});

describe("config urls", () => {
  it("needs both Microsoft variables", () => {
    expect(isMicrosoftMailboxConfigured(env({ MICROSOFT_MAILBOX_CLIENT_ID: "a" }))).toBe(false);
    expect(isMicrosoftMailboxConfigured(env({ MICROSOFT_MAILBOX_CLIENT_ID: "a", MICROSOFT_MAILBOX_CLIENT_SECRET: "b" }))).toBe(true);
  });

  it("enables webhooks only with a token and an https public url", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.clozer.club");
    expect(mailboxWebhooksEnabled(env({ MAILBOX_WEBHOOK_TOKEN: "t".repeat(24) }))).toBe(true);
    expect(mailboxWebhooksEnabled(env({}))).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(mailboxWebhooksEnabled(env({ MAILBOX_WEBHOOK_TOKEN: "t".repeat(24) }))).toBe(false);
  });

  it("builds the webhook and callback urls", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.clozer.club/");
    getEnv.mockReturnValue({ MAILBOX_WEBHOOK_TOKEN: "tok" });
    expect(mailboxWebhookUrl("unipile")).toBe("https://app.clozer.club/api/webhooks/mailboxes/unipile?token=tok");
    expect(oauthCallbackUrl("gmail")).toBe("https://app.clozer.club/api/mailboxes/gmail/callback");
    expect(oauthCallbackUrl("microsoft")).toBe("https://app.clozer.club/api/mailboxes/microsoft/callback");
  });
});
