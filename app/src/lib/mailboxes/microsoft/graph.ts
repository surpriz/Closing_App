import { replyExcerpt } from "@/lib/closing/replies/text";

import { encodeCredentials, type MicrosoftCredentials } from "../credentials";
import { isMailboxError, MailboxError } from "../errors";
import { domainOf, parseAuthenticationResults } from "../inbound/auth";
import { dsnFromHeaders } from "../inbound/dsn";
import type { ConnectorDeps, ConnectorMailbox } from "../index";
import type { InboundHeaders, InboundMessage, MailboxConnector, OutboundMessage, SyncCursor, VerifyResult } from "../types";
import { mapGraphError, refreshAccessToken } from "./oauth";
import { subscriptionExpiry } from "./subscriptions";

const GRAPH = "https://graph.microsoft.com/v1.0";
const REFRESH_MARGIN_MS = 5 * 60_000;
// F10: the list never carries headers or full bodies
const LIST_SELECT = "id,internetMessageId,conversationId,from,toRecipients,subject,receivedDateTime,bodyPreview";
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
const BOUNCE_SENDER = /^(mailer-daemon|postmaster)$/i;

type GraphAddress = { emailAddress?: { address?: string; name?: string } };
type GraphMessage = {
  id: string;
  internetMessageId?: string | null;
  conversationId?: string | null;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  subject?: string | null;
  receivedDateTime?: string;
  bodyPreview?: string | null;
  internetMessageHeaders?: { name: string; value: string }[];
  uniqueBody?: { content?: string } | null;
  "@removed"?: unknown;
};

type GraphJson = GraphMessage & {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
  expirationDateTime?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
};

type CallOptions = { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal };

export function graphConnector(mailbox: ConnectorMailbox, initial: MicrosoftCredentials, deps: ConnectorDeps = {}): MailboxConnector {
  const http = deps.http ?? fetch;
  let creds = initial;

  async function refresh(): Promise<void> {
    creds = await refreshAccessToken(creds, { http });
    // The old refresh token may be dead now: losing the new one would lock the mailbox out
    await deps.persistCredentials?.(encodeCredentials(creds));
  }

  async function accessToken(): Promise<string> {
    const expires = creds.accessTokenExpiresAt ? Date.parse(creds.accessTokenExpiresAt) : 0;
    if (!creds.accessToken || expires - Date.now() < REFRESH_MARGIN_MS) await refresh();
    return creds.accessToken as string;
  }

  /** One authenticated call; a 401 refreshes once and retries. Returns null body for 204/202 style answers. */
  async function call(path: string, opts: CallOptions = {}, retried = false): Promise<{ status: number; json: GraphJson }> {
    // A link from the server is only followed on the Graph host: the bearer must not travel elsewhere
    const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
    if (!url.startsWith(`${GRAPH}/`)) throw new MailboxError("TRANSIENT", "unexpected link from Microsoft");
    const token = await accessToken();
    let res: Response;
    try {
      res = await http(url, {
        method: opts.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
          ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      throw new MailboxError("TRANSIENT", "could not reach Microsoft Graph");
    }
    if (res.status === 401 && !retried) {
      await refresh();
      return call(path, opts, true);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw mapGraphError(res.status, json, res.headers.get("retry-after"));
    return { status: res.status, json };
  }

  const prefer = (extra?: string) => ({ Prefer: [extra, 'IdType="ImmutableId"'].filter(Boolean).join(", ") });

  function recipients(message: OutboundMessage) {
    return [{ emailAddress: { address: message.to.address, ...(message.to.name ? { name: message.to.name } : {}) } }];
  }

  function draftHeaders(message: OutboundMessage) {
    // JSON drafts only accept x-* names; anything else is dropped (customHeaders: false)
    const extra = Object.entries(message.headers ?? {}).filter(([name]) => /^x-/i.test(name));
    return [{ name: "X-Clozer-Id", value: message.idempotencyKey }, ...extra.map(([name, value]) => ({ name, value }))];
  }

  async function send(message: OutboundMessage) {
    const content = {
      subject: message.subject,
      body: { contentType: "html", content: message.html },
      toRecipients: recipients(message),
      internetMessageHeaders: draftHeaders(message),
    };
    let draft: GraphMessage;
    if (message.replyToProviderId) {
      const created = await call(`/me/messages/${encodeURIComponent(message.replyToProviderId)}/createReply`, {
        method: "POST",
        body: {},
        headers: prefer(),
      });
      draft = (
        await call(`/me/messages/${encodeURIComponent(created.json.id)}`, { method: "PATCH", body: content, headers: prefer() })
      ).json;
    } else {
      draft = (await call("/me/messages", { method: "POST", body: content, headers: prefer() })).json;
    }
    try {
      await call(`/me/messages/${encodeURIComponent(draft.id)}/send`, { method: "POST" });
    } catch (error) {
      // Best effort: a failed send must not leave a draft the seller sees in their mailbox
      await call(`/me/messages/${encodeURIComponent(draft.id)}`, { method: "DELETE" }).catch(() => undefined);
      throw error;
    }
    return { messageId: draft.internetMessageId ?? message.messageId, providerId: draft.id, threadId: draft.conversationId ?? null };
  }

  function headersOf(item: GraphMessage) {
    const raw: Record<string, string> = {};
    for (const h of item.internetMessageHeaders ?? []) {
      const name = h.name.toLowerCase();
      // First occurrence is the top-most, the one our own receiving server wrote
      if (raw[name] === undefined) raw[name] = h.value;
    }
    const headers: InboundHeaders = {};
    for (const name of KEPT_HEADERS) if (raw[name] !== undefined) headers[name] = raw[name];
    return { raw, headers };
  }

  function toInbound(item: GraphMessage, detailed: GraphMessage | null): InboundMessage {
    const from = (item.from?.emailAddress?.address ?? "").toLowerCase();
    const { raw, headers } = detailed ? headersOf(detailed) : { raw: {} as Record<string, string>, headers: {} as InboundHeaders };
    const subject = item.subject ?? null;
    const text = detailed ? (detailed.uniqueBody?.content ?? null) : null;
    const dsn = detailed ? dsnFromHeaders({ from, subject, headers, text: text ?? item.bodyPreview ?? null }) : null;
    return {
      id: item.id,
      messageId: item.internetMessageId ?? null,
      inReplyTo: raw["in-reply-to"]?.trim() || null,
      references: raw["references"] ? raw["references"].split(/\s+/).filter(Boolean) : [],
      from: { address: from, name: item.from?.emailAddress?.name || null },
      to: (item.toRecipients ?? []).map((r) => r.emailAddress?.address ?? "").filter(Boolean),
      subject,
      date: item.receivedDateTime ? new Date(item.receivedDateTime) : new Date(),
      textExcerpt: detailed ? replyExcerpt(text ?? item.bodyPreview) : replyExcerpt(item.bodyPreview),
      isDsn: dsn !== null,
      dsn,
      headers,
      authenticated: detailed ? parseAuthenticationResults(headers["authentication-results"], domainOf(from)) : undefined,
      threadId: item.conversationId ?? null,
    };
  }

  /** F10: full headers and the unique body are only read for a reply candidate or a probable bounce. */
  function isCandidate(item: GraphMessage, candidateSenders?: Set<string>) {
    const from = (item.from?.emailAddress?.address ?? "").toLowerCase();
    if (candidateSenders?.has(from)) return true;
    if (BOUNCE_SENDER.test(from.split("@")[0] ?? "")) return true;
    return dsnFromHeaders({ from, subject: item.subject ?? null, headers: {}, text: item.bodyPreview ?? null }) !== null;
  }

  const DETAIL_SELECT = "internetMessageHeaders,uniqueBody";
  const textBody = { Prefer: `outlook.body-content-type="text", IdType="ImmutableId"` };

  async function readDetails(id: string, signal?: AbortSignal) {
    return (
      await call(`/me/messages/${encodeURIComponent(id)}?$select=${DETAIL_SELECT}`, { headers: textBody, signal })
    ).json as GraphMessage;
  }

  async function listNewMessages(
    cursor: SyncCursor,
    opts: { limit: number; notBefore: Date; signal: AbortSignal; candidateSenders?: Set<string> },
  ) {
    const first =
      `/me/mailFolders/inbox/messages/delta?$select=${LIST_SELECT}` +
      `&$filter=${encodeURIComponent(`receivedDateTime ge ${opts.notBefore.toISOString()}`)}`;
    const headers = prefer(`odata.maxpagesize=${opts.limit}`);
    let page: { json: GraphJson };
    try {
      page = await call(cursor ?? first, { headers, signal: opts.signal });
    } catch (error) {
      // 410: the delta token expired; start over, the stored cursor is useless
      if (cursor && isMailboxError(error) && /\b410\b|SyncState/.test(error.options.detail ?? "")) {
        return listNewMessages(null, opts);
      }
      throw error;
    }
    const items: GraphMessage[] = page.json.value ?? [];
    const messages: InboundMessage[] = [];
    for (const item of items) {
      if (opts.signal.aborted) break;
      if (item["@removed"] || !item.id || !item.from?.emailAddress?.address) continue;
      let detailed: GraphMessage | null = null;
      if (isCandidate(item, opts.candidateSenders)) {
        try {
          detailed = await readDetails(item.id, opts.signal);
        } catch (error) {
          if (opts.signal.aborted || (isMailboxError(error) && error.code !== "REJECTED")) throw error;
          // One unreadable message must not block the cursor forever
          detailed = null;
        }
      }
      messages.push(toInbound(item, detailed));
    }
    const next = page.json["@odata.nextLink"];
    const delta = page.json["@odata.deltaLink"];
    if (next) return { messages, cursor: next, hasMore: true };
    return { messages, cursor: delta ?? cursor, hasMore: false };
  }

  async function getMessage(id: string) {
    try {
      const { json } = await call(
        `/me/messages/${encodeURIComponent(id)}?$select=${LIST_SELECT},${DETAIL_SELECT}`,
        { headers: textBody },
      );
      return toInbound(json as GraphMessage, json as GraphMessage);
    } catch (error) {
      if (isMailboxError(error) && /\b404\b/.test(error.options.detail ?? "")) return null;
      throw error;
    }
  }

  async function verify(): Promise<VerifyResult> {
    try {
      const { json } = await call("/me?$select=mail,userPrincipalName,displayName");
      const address = json?.mail ?? json?.userPrincipalName;
      if (typeof address !== "string" || !address) return { ok: false, code: "CONFIG", message: "no address on the account" };
      return { ok: true, address: address.toLowerCase(), displayName: json?.displayName ?? null };
    } catch (error) {
      if (isMailboxError(error)) return { ok: false, code: error.code, message: error.message };
      throw error;
    }
  }

  async function unsubscribe(subscriptionId: string) {
    try {
      await call(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
    } catch (error) {
      // Already gone is the goal
      if (!(isMailboxError(error) && /\b404\b/.test(error.options.detail ?? ""))) throw error;
    }
  }

  return {
    provider: "MICROSOFT",
    capabilities: { customHeaders: false, listUnsubscribe: false, webhooks: true, threadId: true, ownMessageId: false },
    send,
    listNewMessages,
    getMessage,
    verify,
    async disconnect() {
      // Tokens cannot be revoked server-side; dropping the subscription is all there is to do
      if (mailbox.subscriptionId) await unsubscribe(mailbox.subscriptionId);
    },
    async subscribe({ notificationUrl, clientState }) {
      const expiresAt = subscriptionExpiry(new Date());
      const { json } = await call("/subscriptions", {
        method: "POST",
        body: {
          changeType: "created",
          notificationUrl,
          lifecycleNotificationUrl: notificationUrl,
          resource: "/me/mailFolders('inbox')/messages",
          expirationDateTime: expiresAt.toISOString(),
          clientState,
        },
      });
      return { subscriptionId: json.id as string, expiresAt: json.expirationDateTime ? new Date(json.expirationDateTime) : expiresAt };
    },
    async renew(subscriptionId) {
      const expiresAt = subscriptionExpiry(new Date());
      const { json } = await call(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: "PATCH",
        body: { expirationDateTime: expiresAt.toISOString() },
      });
      return { expiresAt: json?.expirationDateTime ? new Date(json.expirationDateTime) : expiresAt };
    },
    unsubscribe,
  };
}
