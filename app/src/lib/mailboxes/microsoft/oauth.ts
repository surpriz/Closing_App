import { getEnv } from "@/lib/env";

import type { MicrosoftCredentials } from "../credentials";
import { MailboxError } from "../errors";

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
export const MICROSOFT_SCOPES = "openid email offline_access User.Read Mail.ReadWrite Mail.Send";

/** Codes meaning the grant is gone for good: the seller has to reconnect. */
const REVOKED_CODES = ["AADSTS70008", "AADSTS50173", "AADSTS700082"];
const AUTH_CODES = ["ErrorAccessDenied", "Authorization_RequestDenied", "InvalidAuthenticationToken"];
const CONFIG_CODES = ["MailboxNotEnabledForRESTAPI", "MailboxNotSupportedForRESTAPI"];
const RECIPIENT_CODES = ["ErrorInvalidRecipients", "ErrorRecipientNotFound", "ErrorNoRecipients", "ErrorInvalidRecipient"];
const DEFAULT_RETRY_MS = 60_000;

type OauthDeps = { http?: typeof fetch; now?: Date };

export type ExchangedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tenantId: string | null;
};

export function authorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPES);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

function retryAfterMs(header: string | null): number {
  const seconds = Number(header);
  if (header && Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = header ? Date.parse(header) : NaN;
  return Number.isNaN(date) ? DEFAULT_RETRY_MS : Math.max(0, date - Date.now());
}

/** Provider errors become coded MailboxErrors; only codes and statuses are kept, never a token or a raw body. */
export function mapGraphError(status: number, body: unknown, retryAfter: string | null): MailboxError {
  const err = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const code = typeof err?.code === "string" ? err.code : "";
  const message = typeof err?.message === "string" ? err.message : "";
  const detail = `graph ${status}${code ? ` ${code}` : ""}`;
  if (status === 429) return new MailboxError("RATE_LIMITED", "rate limited", { retryAfterMs: retryAfterMs(retryAfter), detail });
  if (code === "ErrorSubmissionQuotaExceeded" || code === "ErrorMessageSubmissionBlocked" || /quota/i.test(code) || /\b5\.2\.2\b|quota/i.test(message)) {
    return new MailboxError("QUOTA", "sending quota reached", { detail });
  }
  if (status === 401 || AUTH_CODES.includes(code)) return new MailboxError("AUTH_REVOKED", "access denied by Microsoft", { detail });
  if (CONFIG_CODES.includes(code)) return new MailboxError("CONFIG", "this Microsoft mailbox cannot be used through the API", { detail });
  if (status === 400 && RECIPIENT_CODES.includes(code)) return new MailboxError("REJECTED", "invalid recipient", { detail });
  if (status >= 500) {
    return new MailboxError("TRANSIENT", "Microsoft unavailable", {
      detail,
      retryAfterMs: retryAfter ? retryAfterMs(retryAfter) : undefined,
    });
  }
  // 404 / 410 keep their status in `detail`: callers read it. Anything unrecognised is on our side, not the recipient's.
  return new MailboxError("CONFIG", "request refused by Microsoft", { detail });
}

async function postToken(params: Record<string, string>, deps: OauthDeps) {
  const env = getEnv();
  if (!env.MICROSOFT_MAILBOX_CLIENT_ID || !env.MICROSOFT_MAILBOX_CLIENT_SECRET) {
    throw new MailboxError("CONFIG", "Microsoft mailbox OAuth is not configured");
  }
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_MAILBOX_CLIENT_ID,
    client_secret: env.MICROSOFT_MAILBOX_CLIENT_SECRET,
    ...params,
  });
  let res: Response;
  try {
    res = await (deps.http ?? fetch)(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    throw new MailboxError("TRANSIENT", "could not reach Microsoft");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && json && typeof json.access_token === "string") return json;

  const error = typeof json?.error === "string" ? json.error : "";
  const description = typeof json?.error_description === "string" ? json.error_description : "";
  const aadsts = REVOKED_CODES.find((c) => description.includes(c) || error.includes(c));
  const detail = `token ${res.status}${aadsts ? ` ${aadsts}` : error ? ` ${error}` : ""}`;
  if (error === "invalid_grant" || error === "interaction_required" || error === "consent_required" || aadsts) throw new MailboxError("AUTH_REVOKED", "Microsoft access was revoked", { detail });
  if (res.status === 429) {
    throw new MailboxError("RATE_LIMITED", "Microsoft token endpoint throttled", {
      detail,
      retryAfterMs: retryAfterMs(res.headers.get("retry-after")),
    });
  }
  if (res.status >= 500) throw new MailboxError("TRANSIENT", "Microsoft token endpoint unavailable", { detail });
  throw new MailboxError("CONFIG", "Microsoft refused the token request", { detail });
}

/** The tenant id claim of the id_token; read without verification, it only labels the account. */
function tenantOf(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { tid?: unknown };
    return typeof payload.tid === "string" ? payload.tid : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(
  input: { code: string; codeVerifier: string; redirectUri: string },
  deps: OauthDeps = {},
): Promise<ExchangedTokens> {
  const json = await postToken(
    {
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      scope: MICROSOFT_SCOPES,
    },
    deps,
  );
  if (typeof json.refresh_token !== "string") throw new MailboxError("CONFIG", "Microsoft returned no refresh token");
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: typeof json.scope === "string" ? json.scope : MICROSOFT_SCOPES,
    tenantId: tenantOf(json.id_token),
  };
}

/** Refresh tokens rotate: the returned credentials carry the new one, the caller must persist them. */
export async function refreshAccessToken(creds: MicrosoftCredentials, deps: OauthDeps = {}): Promise<MicrosoftCredentials> {
  const json = await postToken(
    { grant_type: "refresh_token", refresh_token: creds.refreshToken, scope: MICROSOFT_SCOPES },
    deps,
  );
  const now = deps.now ?? new Date();
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  return {
    ...creds,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : creds.refreshToken,
    accessToken: json.access_token as string,
    accessTokenExpiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
    tenantId: creds.tenantId ?? tenantOf(json.id_token),
    scope: typeof json.scope === "string" ? json.scope : creds.scope,
  };
}
