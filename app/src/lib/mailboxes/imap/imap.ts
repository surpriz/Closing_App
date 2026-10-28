import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow";
import PostalMime from "postal-mime";

import { replyExcerpt } from "@/lib/closing/replies/text";

import type { ImapCredentials } from "../credentials";
import { MailboxError } from "../errors";
import { dsnFromHeaders, parseDsn } from "../inbound/dsn";
import { assertSafeMailHost, NETWORK_CODES } from "../safe-host";
import type { InboundHeaders, InboundMessage, SyncCursor } from "../types";

type ImapEndpoint = ImapCredentials["imap"];

const TEXT_LIMIT = 64 * 1024;
const DSN_LIMIT = 256 * 1024;
const HEADER_NAMES = [
  "references",
  "auto-submitted",
  "precedence",
  "x-autoreply",
  "x-autorespond",
  "content-type",
  "list-id",
  "x-failed-recipients",
];
export function mapImapError(error: unknown): MailboxError {
  if (error instanceof MailboxError) return error;
  const e = (error ?? {}) as { authenticationFailed?: boolean; code?: string; responseText?: string; message?: string };
  if (e.authenticationFailed || e.code === "AUTHENTICATIONFAILED" || /AUTHENTICATIONFAILED|invalid credentials/i.test(e.responseText ?? ""))
    return new MailboxError("AUTH_REVOKED", "IMAP authentication failed", { detail: e.responseText });
  if (e.code && NETWORK_CODES.test(e.code)) return new MailboxError("CONFIG", "IMAP server unreachable", { detail: e.code });
  return new MailboxError("TRANSIENT", "IMAP error", { detail: e.responseText ?? e.message });
}

/** One connection per call, always logged out: IMAP servers cap concurrent sessions per account. */
export async function withImap<T>(creds: ImapEndpoint, signal: AbortSignal, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  if (signal.aborted) throw new MailboxError("TRANSIENT", "sync aborted");
  const target = await assertSafeMailHost({ host: creds.host, port: creds.port, kind: "imap" });
  const client = new ImapFlow({
    // Validated address (production) with the original name kept for TLS SNI, against DNS rebinding
    host: target.address,
    ...(target.servername ? { servername: target.servername } : {}),
    port: creds.port,
    secure: creds.secure,
    // Without implicit TLS, force STARTTLS so credentials never cross the wire in clear
    doSTARTTLS: creds.secure ? undefined : true,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
    socketTimeout: 20_000,
    connectionTimeout: 10_000,
  });
  // Without a handler an async socket error would crash the process as an unhandled 'error' event
  client.on("error", () => {});
  const onAbort = () => client.close();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    await client.connect();
    return await fn(client);
  } catch (error) {
    throw mapImapError(error);
  } finally {
    signal.removeEventListener("abort", onAbort);
    await client.logout().catch(() => {});
  }
}

export async function verifyImap(creds: ImapEndpoint): Promise<void> {
  await withImap(creds, AbortSignal.timeout(30_000), async (client) => {
    await client.mailboxOpen("INBOX");
  });
}

type Cursor = { uidValidity: number; lastUid: number };

function parseCursor(cursor: SyncCursor): Cursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(cursor) as Partial<Cursor>;
    if (typeof value.uidValidity === "number" && typeof value.lastUid === "number") return value as Cursor;
  } catch {
    // A corrupt cursor is treated as "never synced"; `notBefore` bounds the re-read
  }
  return null;
}

/** Unfolded "Name: value" lines into a lowercase map; later duplicates are ignored. */
function parseHeaderBlock(raw: Buffer | undefined) {
  const map: Record<string, string> = {};
  if (!raw) return map;
  for (const line of raw.toString("utf8").replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    if (!(name in map)) map[name] = line.slice(idx + 1).trim();
  }
  return map;
}

function findTextPart(node: MessageStructureObject | undefined): { part: string; charset?: string } | null {
  if (!node) return null;
  if (node.childNodes?.length) {
    for (const child of node.childNodes) {
      const found = findTextPart(child);
      if (found) return found;
    }
    return null;
  }
  if (node.type.toLowerCase() === "text/plain" && node.disposition?.toLowerCase() !== "attachment") {
    return { part: node.part ?? "1", charset: node.parameters?.charset };
  }
  return null;
}

async function readCapped(stream: AsyncIterable<Buffer | string>, max: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    chunks.push(buf);
    size += buf.length;
    if (size >= max) break;
  }
  return Buffer.concat(chunks).subarray(0, max);
}

function decode(buf: Buffer, charset: string | undefined) {
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

async function downloadText(client: ImapFlow, uid: number, structure: MessageStructureObject | undefined) {
  const text = findTextPart(structure) ?? { part: "1" };
  const result = await client.download(String(uid), text.part, { uid: true, maxBytes: TEXT_LIMIT });
  if (!result.content) return null;
  return decode(await readCapped(result.content, TEXT_LIMIT), result.meta?.charset ?? text.charset);
}

async function downloadRaw(client: ImapFlow, uid: number) {
  const result = await client.download(String(uid), undefined, { uid: true, maxBytes: DSN_LIMIT });
  if (!result.content) return null;
  return readCapped(result.content, DSN_LIMIT);
}

function toInbound(msg: FetchMessageObject, uidValidity: number): Omit<InboundMessage, "textExcerpt" | "isDsn" | "dsn"> {
  const env = msg.envelope;
  const raw = parseHeaderBlock(msg.headers);
  const headers: InboundHeaders = {};
  for (const name of HEADER_NAMES) {
    if (name !== "references" && raw[name] !== undefined) (headers as Record<string, string>)[name] = raw[name];
  }
  const from = env?.from?.[0];
  const date = env?.date ?? msg.internalDate;
  return {
    id: `${uidValidity}:${msg.uid}`,
    messageId: env?.messageId ?? null,
    inReplyTo: env?.inReplyTo ?? null,
    references: raw.references ? raw.references.split(/\s+/).filter(Boolean) : [],
    from: { address: (from?.address ?? "").toLowerCase(), name: from?.name || null },
    to: (env?.to ?? []).map((a) => a.address ?? "").filter(Boolean),
    subject: env?.subject ?? null,
    date: date ? new Date(date) : new Date(),
    headers,
    threadId: null,
  };
}

export async function listNewImapMessages(
  creds: ImapEndpoint,
  cursor: SyncCursor,
  opts: { limit: number; notBefore: Date; signal: AbortSignal; candidateSenders?: Set<string> },
): Promise<{ messages: InboundMessage[]; cursor: SyncCursor; hasMore: boolean }> {
  return withImap(creds, opts.signal, async (client) => {
    const box = await client.mailboxOpen("INBOX");
    const uidValidity = Number(box.uidValidity);
    const previous = parseCursor(cursor);
    // UIDs are only meaningful within one uidValidity: a change means the mailbox was rebuilt, so start over
    let lastUid = previous && previous.uidValidity === uidValidity ? previous.lastUid : 0;

    const found = (await client.search({ uid: `${lastUid + 1}:*`, since: opts.notBefore }, { uid: true })) || [];
    // "N:*" always matches the highest UID even when it is below N, so drop anything already seen
    const uids = found.filter((uid) => uid > lastUid).sort((a, b) => a - b);
    const batch = uids.slice(0, opts.limit);
    const messages: InboundMessage[] = [];

    if (batch.length > 0) {
      const fetched = await client.fetchAll(
        batch.join(","),
        { uid: true, envelope: true, headers: HEADER_NAMES, bodyStructure: true },
        { uid: true },
      );
      fetched.sort((a, b) => a.uid - b.uid);
      for (const msg of fetched) {
        if (opts.signal.aborted) break;
        const base = toInbound(msg, uidValidity);
        const likelyDsn = dsnFromHeaders({
          from: base.from.address,
          subject: base.subject,
          headers: base.headers,
          text: null,
        });
        const isCandidate =
          likelyDsn !== null ||
          !!base.inReplyTo ||
          base.references.length > 0 ||
          !!opts.candidateSenders?.has(base.from.address);

        let textExcerpt: string | null = null;
        let dsn = likelyDsn;
        try {
          if (likelyDsn) {
            // Bounces need the whole MIME tree (delivery-status part), but capped so a huge bounce cannot hurt
            const rawMail = await downloadRaw(client, msg.uid);
            if (rawMail) dsn = parseDsn(await PostalMime.parse(rawMail));
          } else if (isCandidate) {
            textExcerpt = replyExcerpt(await downloadText(client, msg.uid, msg.bodyStructure));
          }
        } catch {
          // An aborted download is not a poison message: dropping it keeps the cursor before a possible bounce
          if (opts.signal.aborted) break;
          // One poison message must not block the cursor forever: keep the header-only view and move on
          textExcerpt = null;
          dsn = likelyDsn;
          console.warn(`imap: could not read body of uid ${msg.uid}, continuing without it`);
        }
        messages.push({ ...base, textExcerpt, isDsn: dsn !== null, dsn });
        lastUid = msg.uid;
      }
    }

    return {
      messages,
      cursor: JSON.stringify({ uidValidity, lastUid } satisfies Cursor),
      hasMore: uids.length > messages.length,
    };
  });
}
