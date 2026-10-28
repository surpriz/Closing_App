import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ MICROSOFT_MAILBOX_CLIENT_ID: "client-id", MICROSOFT_MAILBOX_CLIENT_SECRET: "client-secret" }),
}));

const { authorizeUrl, exchangeCode, mapGraphError, MICROSOFT_SCOPES, refreshAccessToken } = await import("./oauth");

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const reply = (name: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(fixture(name), { status, headers: { "content-type": "application/json", ...headers } });

const creds = {
  v: 1 as const,
  kind: "microsoft" as const,
  refreshToken: "rt-old",
  accessToken: null,
  accessTokenExpiresAt: null,
  tenantId: null,
  scope: "x",
};

describe("authorizeUrl", () => {
  it("carries PKCE S256, the scopes, the state and the account picker", () => {
    const url = new URL(
      authorizeUrl({ clientId: "cid", redirectUri: "https://app.test/cb", state: "st", codeChallenge: "ch", loginHint: "me@x.io" }),
    );
    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(MICROSOFT_SCOPES);
    expect(url.searchParams.get("scope")).toContain("offline_access");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("login_hint")).toBe("me@x.io");
    expect(url.searchParams.get("client_secret")).toBeNull();
  });
});

describe("exchangeCode", () => {
  it("posts the code with its verifier and reads the tenant from the id token", async () => {
    const http = vi.fn(async () => reply("token-code.json"));
    const out = await exchangeCode({ code: "c", codeVerifier: "v", redirectUri: "https://app.test/cb" }, { http });
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("v");
    expect(out).toMatchObject({ accessToken: "at-1", refreshToken: "rt-1", expiresIn: 3599, tenantId: "tenant-1" });
  });
});

describe("refreshAccessToken", () => {
  it("returns the rotated refresh token and an expiry", async () => {
    const http = vi.fn(async () => reply("token-refresh.json"));
    const now = new Date("2026-10-28T10:00:00Z");
    const next = await refreshAccessToken(creds, { http, now });
    expect(next.refreshToken).toBe("rt-new");
    expect(next.accessToken).toBe("at-new");
    expect(next.accessTokenExpiresAt).toBe(new Date(now.getTime() + 3599_000).toISOString());
  });

  it("keeps the old refresh token when none is returned", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ access_token: "a", expires_in: 60 })));
    expect((await refreshAccessToken(creds, { http })).refreshToken).toBe("rt-old");
  });

  it.each(["AADSTS70008", "AADSTS50173", "AADSTS700082"])("maps %s to AUTH_REVOKED", async (code) => {
    const http = vi.fn(async () => new Response(JSON.stringify({ error: "x", error_description: `${code}: gone` }), { status: 400 }));
    await expect(refreshAccessToken(creds, { http })).rejects.toMatchObject({ code: "AUTH_REVOKED" });
  });

  it("maps invalid_grant to AUTH_REVOKED without leaking the description", async () => {
    const http = vi.fn(async () => reply("error-invalid-grant.json", 400));
    const error = await refreshAccessToken(creds, { http }).catch((e) => e);
    expect(error.code).toBe("AUTH_REVOKED");
    expect(JSON.stringify([error.message, error.options])).not.toMatch(/Trace ID|rt-old|client-secret/);
  });

  it.each(["interaction_required", "consent_required"])("maps %s to AUTH_REVOKED", async (error) => {
    const http = vi.fn(async () => new Response(JSON.stringify({ error }), { status: 400 }));
    await expect(refreshAccessToken(creds, { http })).rejects.toMatchObject({ code: "AUTH_REVOKED" });
  });

  it("maps a token endpoint 429 to RATE_LIMITED", async () => {
    const http = vi.fn(async () => new Response("{}", { status: 429, headers: { "retry-after": "5" } }));
    await expect(refreshAccessToken(creds, { http })).rejects.toMatchObject({ code: "RATE_LIMITED", options: { retryAfterMs: 5000 } });
  });

  it("treats 5xx and network failures as transient", async () => {
    await expect(refreshAccessToken(creds, { http: async () => new Response("{}", { status: 503 }) })).rejects.toMatchObject({
      code: "TRANSIENT",
    });
    await expect(
      refreshAccessToken(creds, {
        http: async () => {
          throw new Error("ECONNRESET");
        },
      }),
    ).rejects.toMatchObject({ code: "TRANSIENT" });
  });
});

describe("mapGraphError", () => {
  it("maps statuses and codes", () => {
    expect(mapGraphError(429, null, "30")).toMatchObject({ code: "RATE_LIMITED", options: { retryAfterMs: 30_000 } });
    expect(mapGraphError(429, null, null).options.retryAfterMs).toBe(60_000);
    expect(mapGraphError(550, JSON.parse(fixture("error-quota.json")), null).code).toBe("QUOTA");
    expect(mapGraphError(401, null, null).code).toBe("AUTH_REVOKED");
    expect(mapGraphError(403, { error: { code: "ErrorAccessDenied" } }, null).code).toBe("AUTH_REVOKED");
    expect(mapGraphError(400, { error: { code: "ErrorInvalidRecipients" } }, null).code).toBe("REJECTED");
    expect(mapGraphError(502, null, null).code).toBe("TRANSIENT");
    expect(mapGraphError(403, { error: { code: "ErrorMessageSubmissionBlocked" } }, null).code).toBe("QUOTA");
    expect(mapGraphError(403, { error: { code: "Something" } }, null).code).toBe("CONFIG");
    expect(mapGraphError(401, { error: { code: "InvalidAuthenticationToken" } }, null).code).toBe("AUTH_REVOKED");
    expect(mapGraphError(403, { error: { code: "Authorization_RequestDenied" } }, null).code).toBe("AUTH_REVOKED");
    expect(mapGraphError(404, { error: { code: "MailboxNotEnabledForRESTAPI" } }, null).code).toBe("CONFIG");
    expect(mapGraphError(400, { error: { code: "ErrorWhatever" } }, null).code).toBe("CONFIG");
    expect(mapGraphError(404, { error: { code: "ErrorItemNotFound" } }, null).options.detail).toContain("404");
    expect(mapGraphError(410, null, null).options.detail).toContain("410");
  });
});

describe("mapGraphError contexts", () => {
  it("treats message-specific refusals on the send path as REJECTED", () => {
    expect(mapGraphError(413, null, null, "send").code).toBe("REJECTED");
    expect(mapGraphError(400, { error: { code: "ErrorMessageSizeExceeded" } }, null, "send").code).toBe("REJECTED");
    expect(mapGraphError(400, { error: { code: "ErrorInvalidIdMalformed" } }, null, "send").code).toBe("REJECTED");
    expect(mapGraphError(400, { error: { code: "ErrorInvalidRecipients" } }, null, "send").code).toBe("REJECTED");
  });
  it("keeps unknown 4xx as CONFIG outside the send path and for non-400 on send", () => {
    expect(mapGraphError(400, { error: { code: "X" } }, null, "read").code).toBe("CONFIG");
    expect(mapGraphError(409, { error: { code: "X" } }, null, "send").code).toBe("CONFIG");
  });
  it("limits QUOTA to submission limits", () => {
    expect(mapGraphError(403, { error: { code: "ErrorSubmissionQuotaExceeded" } }, null, "send").code).toBe("QUOTA");
    expect(mapGraphError(403, { error: { code: "ErrorQuotaExceeded", message: "mailbox is full" } }, null, "send").code).toBe("CONFIG");
  });
});

