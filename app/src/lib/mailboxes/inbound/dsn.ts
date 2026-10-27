import type PostalMime from "postal-mime";

import type { DsnDetails, InboundHeaders } from "../types";

export type ParsedEmail = Awaited<ReturnType<typeof PostalMime.parse>>;

const MAX_DIAGNOSTIC = 300;
const MAX_TEXT = 20_000;
const RECIPIENT = /[^\s<>;,"]{1,254}@[^\s<>;,"]{1,254}/;
const DSN_SUBJECT = /undeliver|non remis|delivery status notification|mail delivery failed|échec/i;
const DSN_SENDER = /^(mailer-daemon|postmaster)$/i;
const STATUS = /\b([45]\.\d{1,3}\.\d{1,3})\b/;
const UNKNOWN_USER = /does not exist|recipientnotfound|user unknown|550[- ]5\.1\.1/i;

/** postal-mime surfaces the nested parts of a multipart/report as attachments: read them as text. */
function partText(content: ArrayBuffer | Uint8Array | string) {
  return typeof content === "string" ? content : new TextDecoder().decode(content);
}

/** Header value from a block of "Name: value" lines, continuation lines (leading whitespace) unfolded. */
function field(block: string, name: string) {
  const match = new RegExp(`^${name}:[ \\t]*((?:.*)(?:\\r?\\n[ \\t]+.*)*)`, "im").exec(block);
  return match ? match[1].replace(/\r?\n[ \t]+/g, " ").trim() : null;
}

function oneLine(value: string | null) {
  const line = value?.replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length > MAX_DIAGNOSTIC ? line.slice(0, MAX_DIAGNOSTIC - 1).trimEnd() + "…" : line;
}

/** "rfc822; user@host" -> "user@host" */
function address(value: string | null) {
  if (!value) return null;
  const raw = value.includes(";") ? value.slice(value.indexOf(";") + 1) : value;
  const found = RECIPIENT.exec(raw);
  return found ? found[0].toLowerCase() : null;
}

function actionOf(value: string | null, status: string | null): DsnDetails["action"] {
  const action = value?.toLowerCase();
  if (action === "failed" || action === "delayed") return action;
  if (status?.startsWith("5")) return "failed";
  if (status?.startsWith("4")) return "delayed";
  return "other";
}

function messageIdIn(block: string | null) {
  return block ? (field(block, "Message-ID")?.match(/<[^>]+>/)?.[0] ?? field(block, "Message-ID")) : null;
}

/**
 * A DSN from its MIME structure (RFC 3464). Falls back to the heuristics of `dsnFromHeaders` when the
 * message is not a proper multipart/report, since many servers send plain-text bounces.
 */
export function parseDsn(email: ParsedEmail): DsnDetails | null {
  const contentType = email.headers.find((h) => h.key === "content-type")?.value ?? "";
  const failedRecipients = email.headers.find((h) => h.key === "x-failed-recipients")?.value;
  const headers: InboundHeaders = { "content-type": contentType };
  if (failedRecipients) headers["x-failed-recipients"] = failedRecipients;
  const fallback = () =>
    dsnFromHeaders({ from: email.from?.address ?? "", subject: email.subject ?? null, headers, text: email.text ?? null });

  if (!/multipart\/report/i.test(contentType) || !/report-type=["']?delivery-status/i.test(contentType)) return fallback();

  const status = email.attachments.find((a) => a.mimeType.toLowerCase() === "message/delivery-status");
  if (!status) return fallback();
  const block = partText(status.content);
  const original = email.attachments.find((a) => /^(message\/rfc822|text\/rfc822-headers)$/i.test(a.mimeType));

  const code = field(block, "Status")?.match(STATUS)?.[1] ?? null;
  return {
    action: actionOf(field(block, "Action"), code),
    status: code,
    diagnostic: oneLine(field(block, "Diagnostic-Code")?.replace(/^\w+;\s*/, "") ?? null),
    failedRecipient: address(field(block, "Final-Recipient")) ?? address(field(block, "Original-Recipient")),
    originalMessageId: messageIdIn(original ? partText(original.content) : null),
  };
}

/**
 * A DSN recognised without MIME parsing: connectors that only give us headers and a text excerpt.
 * Returns null when nothing looks like a bounce, so a human reply is never taken for one.
 */
export function dsnFromHeaders(input: {
  from: string;
  subject: string | null;
  headers: InboundHeaders;
  text: string | null;
}): DsnDetails | null {
  const local = input.from.split("@")[0] ?? "";
  const failedRecipients = input.headers["x-failed-recipients"];
  const isReport = /multipart\/report/i.test(input.headers["content-type"] ?? "");
  // Words like "échec" are ordinary: the subject alone never proves a bounce
  const strongSignal = DSN_SENDER.test(local) || !!failedRecipients || isReport;
  const subjectSignal = DSN_SUBJECT.test(input.subject ?? "");
  if (!strongSignal && !subjectSignal) return null;

  // Bounded: the text is attacker-controlled and the scans below must stay linear
  const text = (input.text ?? "").slice(0, MAX_TEXT);
  const status = STATUS.exec(text)?.[1] ?? null;
  const unknownUser = UNKNOWN_USER.exec(text);
  if (!strongSignal && !status && !unknownUser) return null;

  const delayed = /delay|retried|will keep trying/i.test(input.subject ?? "") || /delayed/i.test(text.slice(0, 400));
  const recipient = failedRecipients?.split(/[,;\s]+/).find(Boolean) ?? RECIPIENT.exec(text)?.[0];

  // The line that carries the evidence is the most useful diagnostic we can keep
  const lines = text.split(/\r?\n/);
  const line = lines.find((l) => (status ? STATUS.test(l) : UNKNOWN_USER.test(l)));
  // A status class is authoritative; the "delayed" wording only counts when there is no status
  const action: DsnDetails["action"] = status ? actionOf(null, status) : delayed ? "delayed" : unknownUser ? "failed" : "other";

  return {
    action,
    status,
    diagnostic: oneLine(line ?? null),
    failedRecipient: recipient ? recipient.toLowerCase() : null,
    originalMessageId: messageIdIn(text),
  };
}
