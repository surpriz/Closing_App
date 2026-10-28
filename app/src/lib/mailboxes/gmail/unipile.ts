import { getEnv } from "@/lib/env";

import type { UnipileCredentials } from "../credentials";
import { isMailboxError, MailboxError } from "../errors";
import type { ConnectorDeps } from "../index";
import { parseAuthenticationResults, domainOf } from "../inbound/auth";
import { dsnFromHeaders } from "../inbound/dsn";
import { mailboxWebhookUrl } from "../config";
import { notifySignature, unipileHeaderToken } from "../webhooks/unipile-secrets";
import type { InboundHeaders, InboundMessage, MailboxConnector, SendResult, SyncCursor, VerifyResult } from "../types";

// Every Unipile field name we depend on is read in this file; the mapping functions are the single place to adjust
// after the spike against a real account (accountInfo, mapEmail, customHeaderFields, mapUnipileError).

const EXCERPT_MAX = 1000;
const PAGE_MAX = 100;
const LINK_TTL_MS = 15 * 60_000;
const OVERLAP_MS = 60 * 60_000; // late-dated replies must not fall behind the boundary; duplicates are absorbed downstream
const RFC_MESSAGE_ID = /^<[^<>\s@]+@[^<>\s]+>$/;
const KEPT_HEADERS = [
  "auto-submitted",
  "authentication-results",
  "precedence",
  "x-autoreply",
  "x-autorespond",
  "content-type",
  "list-id",
  "x-failed-recipients",
] as const;

type Json = Record<string, unknown>;
type Deps = Pick<ConnectorDeps, "http">;

function httpFor(deps: Deps): typeof fetch {
  return deps.http ?? fetch;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function baseUrl() {
  const { UNIPILE_DSN, UNIPILE_API_KEY } = getEnv();
  if (!UNIPILE_DSN || !UNIPILE_API_KEY) throw new MailboxError("CONFIG", "unipile is not configured");
  return { dsn: UNIPILE_DSN.replace(/\/+$/, ""), key: UNIPILE_API_KEY };
}

function retryAfterMs(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined;
}

/** Translates a failed response; the body is only read for its error type, never echoed in full, never a secret. */
async function mapUnipileError(response: Response, context: "send" | "account" | "read"): Promise<MailboxError> {
  const body = obj(await response.json().catch(() => null));
  const type = str(body.type) ?? "";
  const detail = `unipile ${response.status}${type ? ` ${type.slice(0, 80)}` : ""}`;
  const { status } = response;
  // Account-level problems first: a 401/403 carrying one of these is the mailbox, not our key
  if (/disconnected|credentials|invalid_account|permissions/i.test(type)) {
    return new MailboxError("AUTH_REVOKED", "the mailbox must be reconnected", { detail });
  }
  if (status === 401 || status === 403) return new MailboxError("CONFIG", "unipile rejected our API key", { detail });
  if (status === 429) return new MailboxError("RATE_LIMITED", "unipile rate limit", { retryAfterMs: retryAfterMs(response), detail });
  if (status >= 500) return new MailboxError("TRANSIENT", "unipile unavailable", { detail });
  if (status === 404 && context === "account") return new MailboxError("AUTH_REVOKED", "unipile account not found", { detail });
  if (context === "send" && (status === 400 || status === 422)) {
    // A bare 400 is more likely our request than the recipient: only recipient-looking types reject the message
    if (status === 422 || /recipient|address|attendee/i.test(type)) {
      return new MailboxError("REJECTED", "recipient or message rejected", { detail });
    }
    return new MailboxError("CONFIG", "unipile refused the request", { detail });
  }
  return new MailboxError("TRANSIENT", "unexpected unipile answer", { detail });
}

async function call(
  deps: Deps,
  path: string,
  init: RequestInit & { context: "send" | "account" | "read" },
): Promise<Json> {
  const { dsn, key } = baseUrl();
  const { context, ...rest } = init;
  let response: Response;
  try {
    response = await httpFor(deps)(`${dsn}${path}`, {
      ...rest,
      headers: { "X-API-KEY": key, accept: "application/json", ...(rest.headers as Record<string, string> | undefined) },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new MailboxError("TRANSIENT", "unipile unreachable");
  }
  if (!response.ok) throw await mapUnipileError(response, context);
  return obj(await response.json().catch(() => null));
}

/** Account document -> what we use. `connection_params.mail.username` is the address for Gmail accounts. */
function accountInfo(doc: Json) {
  const mail = obj(obj(doc.connection_params).mail);
  const sources = Array.isArray(doc.sources) ? doc.sources : [];
  return {
    address: str(mail.username) ?? str(mail.email) ?? null,
    name: str(doc.name),
    status: str(obj(sources[0]).status),
  };
}

export async function getUnipileAccount(accountId: string, deps: Deps = {}) {
  const doc = await call(deps, `/api/v1/accounts/${encodeURIComponent(accountId)}`, { method: "GET", context: "account" });
  return accountInfo(doc);
}

/** Recipient fields of the multipart form; isolated because the exact encoding (`to[0][identifier]`) is spike-verified. */
function recipientFields(to: { address: string; name?: string | null }): [string, string][] {
  const fields: [string, string][] = [["to[0][identifier]", to.address]];
  if (to.name) fields.push(["to[0][display_name]", to.name]);
  return fields;
}

/** custom_headers entries as the multipart form carries them; isolated because the exact encoding is spike-verified. */
function customHeaderFields(headers: Record<string, string>): [string, string][] {
  return Object.entries(headers).flatMap(([name, value], i) => [
    [`custom_headers[${i}][name]`, name],
    [`custom_headers[${i}][value]`, value],
  ] as [string, string][]);
}

function headerMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const list = Array.isArray(raw) ? raw : [];
  for (const entry of list) {
    const name = str(obj(entry).name)?.toLowerCase();
    const value = str(obj(entry).value);
    if (name && value !== null && out[name] === undefined) out[name] = value;
  }
  return out;
}

function messageIdOf(value: unknown): string | null {
  const id = typeof value === "string" ? value : str(obj(value).message_id);
  return id ? id.trim() : null;
}

function mapEmail(item: Json): InboundMessage | null {
  const id = str(item.id);
  if (!id) return null;
  const raw = headerMap(item.headers);
  const headers: InboundHeaders = {};
  for (const name of KEPT_HEADERS) if (raw[name] !== undefined) headers[name] = raw[name];
  const from = obj(item.from_attendee);
  const address = (str(from.identifier) ?? "").toLowerCase();
  const refs = item.references;
  const references = Array.isArray(refs)
    ? refs.map(messageIdOf).filter((v): v is string => !!v)
    : (str(refs)?.split(/\s+/).filter(Boolean) ?? []);
  const date = new Date(str(item.date) ?? Date.now());
  const text = str(item.body_plain);
  const subject = str(item.subject);
  const dsn = dsnFromHeaders({ from: address, subject, headers, text });
  return {
    id,
    messageId: messageIdOf(item.message_id),
    inReplyTo: messageIdOf(item.in_reply_to),
    references,
    from: { address, name: str(from.display_name) },
    to: (Array.isArray(item.to_attendees) ? item.to_attendees : []).map((a) => str(obj(a).identifier) ?? "").filter(Boolean),
    subject,
    date: Number.isNaN(date.getTime()) ? new Date() : date,
    textExcerpt: text ? text.slice(0, EXCERPT_MAX) : null,
    isDsn: dsn !== null,
    dsn,
    headers,
    authenticated: parseAuthenticationResults(headers["authentication-results"], domainOf(address)),
    threadId: str(item.thread_id),
  };
}

type PageCursor = { after: string | null; max: string | null; next: string | null };

function parseCursor(cursor: SyncCursor): PageCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(cursor) as Partial<PageCursor>;
    return { after: str(value.after), max: str(value.max), next: str(value.next) };
  } catch {
    // Corrupt: treated as never synced, `notBefore` bounds the re-read
    return null;
  }
}

export function unipileConnector(
  mailbox: { email: string; displayName: string | null },
  creds: UnipileCredentials,
  deps: ConnectorDeps = {},
): MailboxConnector {
  const accountPath = encodeURIComponent(creds.accountId);

  async function readEmail(id: string, headers: boolean): Promise<Json> {
    const query = new URLSearchParams({ account_id: creds.accountId });
    if (headers) query.set("include_headers", "true");
    return call(deps, `/api/v1/emails/${encodeURIComponent(id)}?${query}`, { method: "GET", context: "read" });
  }

  return {
    provider: "GOOGLE",
    capabilities: { customHeaders: true, listUnsubscribe: true, webhooks: true, threadId: true, ownMessageId: false },

    async send(message): Promise<SendResult> {
      const form = new FormData();
      form.set("account_id", creds.accountId);
      for (const [name, value] of recipientFields(message.to)) form.set(name, value);
      form.set("subject", message.subject);
      form.set("body", message.html);
      for (const [name, value] of customHeaderFields(message.headers ?? {})) form.set(name, value);
      if (message.replyToProviderId) form.set("reply_to", message.replyToProviderId);
      const sent = await call(deps, "/api/v1/emails", {
        method: "POST",
        body: form,
        headers: { "Idempotency-Key": message.idempotencyKey },
        context: "send",
      });
      const providerId = str(sent.provider_id) ?? str(sent.tracking_id);
      // The mail has left: a failed read-back must not turn into a failed send (the sender would send it twice)
      let rfc: string | null = null;
      let threadId: string | null = null;
      if (providerId) {
        try {
          const back = await readEmail(providerId, false);
          const id = messageIdOf(back.message_id);
          rfc = id && RFC_MESSAGE_ID.test(id) ? id : null;
          threadId = str(back.thread_id);
        } catch {
          // keep the fallbacks below
        }
      }
      // Types want a string: without the provider's RFC id our own never went on the wire, matching rides on threadId
      return { messageId: rfc ?? message.messageId, providerId, threadId };
    },

    async listNewMessages(cursor, opts) {
      const state = parseCursor(cursor);
      const after = state?.after ?? opts.notBefore.toISOString();
      const query = new URLSearchParams({
        account_id: creds.accountId,
        role: "inbox",
        after,
        limit: String(Math.min(opts.limit, PAGE_MAX)),
        include_headers: "true",
      });
      if (state?.next) query.set("cursor", state.next);
      const page = await call(deps, `/api/v1/emails?${query}`, { method: "GET", signal: opts.signal, context: "read" });
      const messages = (Array.isArray(page.items) ? page.items : [])
        .map((item) => mapEmail(obj(item)))
        .filter((m): m is InboundMessage => m !== null);
      let max = state?.max ?? null;
      for (const raw of Array.isArray(page.items) ? page.items : []) {
        // An item without a valid date must not move the boundary (mapEmail falls back to "now" for it)
        const time = Date.parse(str(obj(raw).date) ?? "");
        if (!Number.isNaN(time) && (!max || new Date(time).toISOString() > max)) max = new Date(time).toISOString();
      }
      const next = str(page.cursor);
      if (next) {
        return { messages, cursor: JSON.stringify({ after, max, next } satisfies PageCursor), hasMore: true };
      }
      // Done: next time start just before the newest message seen (duplicates are absorbed downstream)
      const resume = max ? new Date(new Date(max).getTime() - OVERLAP_MS).toISOString() : after;
      return { messages, cursor: JSON.stringify({ after: resume, max: null, next: null } satisfies PageCursor), hasMore: false };
    },

    async getMessage(id) {
      return mapEmail(await readEmail(id, true));
    },

    async verify(): Promise<VerifyResult> {
      try {
        const info = await getUnipileAccount(creds.accountId, deps);
        if (info.status === "OK") return { ok: true, address: info.address ?? mailbox.email, displayName: mailbox.displayName };
        const revoked = !info.status || /CREDENTIALS|DISCONNECTED|PERMISSIONS/i.test(info.status);
        return {
          ok: false,
          code: revoked ? "AUTH_REVOKED" : "TRANSIENT",
          message: `unipile account status ${info.status ?? "unknown"}`,
        };
      } catch (error) {
        const e = isMailboxError(error) ? error : new MailboxError("TRANSIENT", "verification failed");
        return { ok: false, code: e.code, message: e.options.detail ? `${e.message}: ${e.options.detail}` : e.message };
      }
    },

    async disconnect() {
      try {
        await call(deps, `/api/v1/accounts/${accountPath}`, { method: "DELETE", context: "account" });
      } catch (error) {
        // Already gone on their side is the outcome we wanted
        if (isMailboxError(error) && error.code === "AUTH_REVOKED") return;
        throw error;
      }
    },
  };
}

/** Hosted auth: one link per connection attempt; `name` carries our OAuth state id back to the notify webhook. */
export async function createHostedAuthLink(
  input: {
    stateId: string;
    type: "create" | "reconnect";
    reconnectAccountId?: string;
    successUrl: string;
    failureUrl: string;
  },
  deps: Deps & { now?: Date } = {},
): Promise<string> {
  const { dsn } = baseUrl();
  // The webhook URL already carries ?token=: the path segment goes on the pathname, not after the query
  const notify = new URL(mailboxWebhookUrl("unipile"));
  notify.pathname = `${notify.pathname.replace(/\/$/, "")}/notify`;
  notify.searchParams.set("sig", notifySignature(input.stateId));
  const now = deps.now ?? new Date();
  const doc = await call(deps, "/api/v1/hosted/accounts/link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: input.type,
      providers: ["GOOGLE"],
      api_url: dsn,
      expiresOn: new Date(now.getTime() + LINK_TTL_MS).toISOString(),
      name: input.stateId,
      notify_url: notify.toString(),
      success_redirect_url: input.successUrl,
      failure_redirect_url: input.failureUrl,
      ...(input.type === "reconnect" && input.reconnectAccountId ? { reconnect_account: input.reconnectAccountId } : {}),
    }),
    context: "account",
  });
  const url = str(doc.url);
  if (!url) throw new MailboxError("TRANSIENT", "unipile returned no link");
  return url;
}

/**
 * Registers our webhooks once per source: matched on request_url + source so a second call creates nothing.
 * Unipile does not sign webhooks, so the shared token travels both in the URL and in a custom header.
 */
export async function ensureUnipileWebhook(deps: Deps = {}): Promise<{ created: number }> {
  const token = getEnv().MAILBOX_WEBHOOK_TOKEN;
  if (!token) throw new MailboxError("CONFIG", "MAILBOX_WEBHOOK_TOKEN is not set");
  const requestUrl = mailboxWebhookUrl("unipile");
  const existing = await call(deps, "/api/v1/webhooks", { method: "GET", context: "account" });
  const have = new Set(
    (Array.isArray(existing.items) ? existing.items : [])
      .map(obj)
      .filter((w) => w.request_url === requestUrl)
      .map((w) => str(w.source)),
  );
  let created = 0;
  for (const spec of [
    { source: "email", events: ["mail_received"] },
    { source: "account_status", events: undefined },
  ]) {
    if (have.has(spec.source)) continue;
    await call(deps, "/api/v1/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: spec.source,
        request_url: requestUrl,
        headers: [{ key: "x-clozer-token", value: unipileHeaderToken() }],
        ...(spec.events ? { events: spec.events } : {}),
      }),
      context: "account",
    });
    created++;
  }
  return { created };
}
