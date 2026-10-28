import { getEnv } from "@/lib/env";
import { replyExcerpt } from "@/lib/closing/replies/text";
import { oauthCallbackUrl } from "../config";
import type { ConnectorDeps } from "../index";
import type { NylasCredentials } from "../credentials";
import { MailboxError, type MailboxErrorCode } from "../errors";
import { domainOf, parseAuthenticationResults } from "../inbound/auth";
import { dsnFromHeaders } from "../inbound/dsn";
import type { InboundHeaders, InboundMessage, MailboxConnector, SyncCursor, VerifyResult } from "../types";

const EXCERPT_MAX = 600;
const KEPT_HEADERS = ["auto-submitted", "authentication-results", "precedence", "x-autoreply", "x-autorespond", "content-type", "list-id", "x-failed-recipients"] as const;

type NylasHeader = { name?: string; value?: string };
type NylasAddress = { email?: string; name?: string };
type NylasMessage = {
  id?: string;
  thread_id?: string;
  from?: NylasAddress[];
  to?: NylasAddress[];
  subject?: string;
  date?: number;
  snippet?: string;
  headers?: NylasHeader[];
};

type Http = typeof fetch;

function base() {
  return getEnv().NYLAS_API_URL.replace(/\/+$/, "");
}

/** Hosted OAuth URL; `state` is our MailboxOauthState id. */
export function nylasAuthorizeUrl(input: { state: string; loginHint?: string | null }): string {
  const env = getEnv();
  const url = new URL(`${base()}/v3/connect/auth`);
  url.searchParams.set("client_id", env.NYLAS_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", oauthCallbackUrl("gmail"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("provider", "google");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("state", input.state);
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

function detailOf(body: unknown): string | undefined {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" ? message.slice(0, 200) : undefined;
}

/** Maps a Nylas failure; the detail comes from the error message only, never from the request. */
function mapFailure(status: number, body: unknown, retryAfter: string | null): MailboxError {
  const detail = detailOf(body);
  const seconds = Number(retryAfter);
  const retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
  let code: MailboxErrorCode;
  if (status === 401 || status === 403 || status === 404) code = "AUTH_REVOKED";
  else if (status === 429) code = "RATE_LIMITED";
  else if (status >= 500) code = "TRANSIENT";
  else if (/quota|rate limit exceeded|sending limit/i.test(detail ?? "")) code = "QUOTA";
  else code = "REJECTED";
  return new MailboxError(code, `nylas ${status}`, { detail, retryAfterMs });
}

async function call(http: Http, path: string, init: RequestInit & { json?: unknown } = {}): Promise<unknown> {
  const { json, ...rest } = init;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getEnv().NYLAS_API_KEY ?? ""}`,
    Accept: "application/json",
    ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  let res: Response;
  try {
    res = await http(`${base()}${path}`, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : undefined });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new MailboxError("TRANSIENT", "nylas unreachable");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw mapFailure(res.status, body, res.headers.get("retry-after"));
  return body;
}

export type NylasExchange = { grantId: string; email: string };

/** Trades the authorization code for the grant. The API key doubles as the client secret. */
export async function exchangeNylasCode(code: string, deps: { http?: Http } = {}): Promise<NylasExchange> {
  const env = getEnv();
  const body = (await call(deps.http ?? fetch, "/v3/connect/token", {
    method: "POST",
    json: {
      code,
      client_id: env.NYLAS_CLIENT_ID,
      client_secret: env.NYLAS_API_KEY,
      redirect_uri: oauthCallbackUrl("gmail"),
      grant_type: "authorization_code",
    },
  })) as { grant_id?: string; email?: string } | null;
  if (!body?.grant_id || !body.email) throw new MailboxError("REJECTED", "nylas token response incomplete");
  return { grantId: body.grant_id, email: body.email.trim().toLowerCase() };
}

/** Case-insensitive header lookup. Nylas exposes headers as [{ name, value }]; isolated here in case that moves. */
function headerValue(headers: NylasHeader[] | undefined, name: string): string | null {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

/** Field mapping for a listed message: the only place that knows the Nylas message shape. */
function toInbound(m: NylasMessage): InboundMessage {
  const from = m.from?.[0];
  const headers: InboundHeaders = {};
  for (const name of KEPT_HEADERS) {
    const value = headerValue(m.headers, name);
    if (value !== null) headers[name] = value;
  }
  const address = (from?.email ?? "").toLowerCase();
  const text = m.snippet ? m.snippet.slice(0, EXCERPT_MAX) : null;
  const subject = m.subject ?? null;
  const dsn = dsnFromHeaders({ from: address, subject, headers, text });
  return {
    id: m.id ?? "",
    messageId: headerValue(m.headers, "message-id"),
    inReplyTo: headerValue(m.headers, "in-reply-to"),
    references: (headerValue(m.headers, "references") ?? "").split(/\s+/).filter(Boolean),
    from: { address, name: from?.name || null },
    to: (m.to ?? []).map((a) => a.email ?? "").filter(Boolean),
    subject,
    date: new Date((m.date ?? 0) * 1000),
    textExcerpt: replyExcerpt(text, EXCERPT_MAX),
    isDsn: dsn !== null,
    dsn,
    headers,
    authenticated: parseAuthenticationResults(headers["authentication-results"], domainOf(address)),
    threadId: m.thread_id ?? null,
  };
}

// Cursor: "date:<unix>" between runs; "page:<after>:<maxSeen>:<token>" while paging through one window.
function parseCursor(cursor: SyncCursor, notBefore: Date) {
  const page = /^page:(\d+):(\d+):(.+)$/.exec(cursor ?? "");
  if (page) return { after: Number(page[1]), maxSeen: Number(page[2]), token: page[3] };
  const date = /^date:(\d+)$/.exec(cursor ?? "");
  return { after: date ? Number(date[1]) : Math.floor(notBefore.getTime() / 1000), maxSeen: 0, token: null };
}

export function nylasConnector(
  mailbox: { email: string; displayName: string | null },
  creds: NylasCredentials,
  deps: ConnectorDeps = {},
): MailboxConnector {
  const http = deps.http ?? fetch;
  const grant = `/v3/grants/${encodeURIComponent(creds.grantId)}`;
  return {
    provider: "GOOGLE",
    capabilities: { customHeaders: true, listUnsubscribe: true, webhooks: true, threadId: true, ownMessageId: false },
    async send(message) {
      const customHeaders = Object.entries(message.headers ?? {}).map(([name, value]) => ({ name, value }));
      const body = (await call(http, `${grant}/messages/send`, {
        method: "POST",
        json: {
          to: [{ email: message.to.address, name: message.to.name ?? undefined }],
          subject: message.subject,
          body: message.html,
          ...(message.replyToProviderId ? { reply_to_message_id: message.replyToProviderId } : {}),
          ...(customHeaders.length ? { custom_headers: customHeaders } : {}),
        },
      })) as { data?: NylasMessage } | null;
      const sent = body?.data;
      if (!sent?.id) throw new MailboxError("TRANSIENT", "nylas send response incomplete");
      let messageId = headerValue(sent.headers, "message-id");
      if (!messageId) {
        // The mail left already: a failed read-back must not fail the send
        try {
          const read = (await call(http, `${grant}/messages/${encodeURIComponent(sent.id)}?fields=include_headers`)) as {
            data?: NylasMessage;
          } | null;
          messageId = headerValue(read?.data?.headers, "message-id");
        } catch {
          messageId = null;
        }
      }
      // ownMessageId is false: Gmail assigns the Message-ID. Without it we fall back on ours; thread matching covers.
      return { messageId: messageId ?? message.messageId, providerId: sent.id, threadId: sent.thread_id ?? null };
    },
    async listNewMessages(cursor, opts) {
      const { after, maxSeen, token } = parseCursor(cursor, opts.notBefore);
      const query = new URLSearchParams({
        in: "INBOX",
        received_after: String(after),
        limit: String(opts.limit),
        fields: "include_headers",
      });
      if (token) query.set("page_token", token);
      const body = (await call(http, `${grant}/messages?${query}`, { signal: opts.signal })) as {
        data?: NylasMessage[];
        next_cursor?: string;
      } | null;
      const raw = body?.data ?? [];
      const messages = raw.map(toInbound);
      const newest = Math.max(maxSeen, ...raw.map((m) => m.date ?? 0));
      const next = body?.next_cursor;
      if (next) return { messages, cursor: `page:${after}:${newest}:${next}`, hasMore: true };
      return { messages, cursor: `date:${newest || after}`, hasMore: false };
    },
    async verify(): Promise<VerifyResult> {
      try {
        const body = (await call(http, grant)) as { data?: { grant_status?: string; email?: string } } | null;
        if (body?.data?.grant_status !== "valid") {
          return { ok: false, code: "AUTH_REVOKED", message: "nylas grant is not valid" };
        }
        return { ok: true, address: body.data.email ?? mailbox.email, displayName: mailbox.displayName };
      } catch (error) {
        const e = error instanceof MailboxError ? error : new MailboxError("TRANSIENT", "verification failed");
        return { ok: false, code: e.code, message: e.options.detail ? `${e.message}: ${e.options.detail}` : e.message };
      }
    },
    async disconnect() {
      await call(http, grant, { method: "DELETE" });
    },
  };
}
