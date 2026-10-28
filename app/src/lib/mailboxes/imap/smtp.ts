import nodemailer from "nodemailer";

import type { ImapCredentials } from "../credentials";
import { MailboxError } from "../errors";
import { assertSafeMailHost, NETWORK_CODES } from "../safe-host";
import type { OutboundMessage, SendResult } from "../types";

type SmtpCredentials = ImapCredentials["smtp"];

/** One transporter per call: nothing is created at import time and nothing is pooled across mailboxes. */
export function createSmtpTransport(creds: SmtpCredentials, target?: { address: string; servername?: string }) {
  return nodemailer.createTransport({
    // `target` is the address already validated by assertSafeMailHost; the name stays as the TLS SNI/cert name
    host: target?.address ?? creds.host,
    port: creds.port,
    secure: creds.secure,
    // Never fall back to plaintext auth if the server (or a middlebox) hides STARTTLS
    requireTLS: !creds.secure,
    ...(target?.servername ? { tls: { servername: target.servername } } : {}),
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
    greetingTimeout: 10_000,
  });
}

type SmtpFailure = { code?: string; responseCode?: number; response?: string; message?: string };

/** Maps a nodemailer failure to the codes the sender acts on (pause, retry later, or drop the message). */
export function mapSmtpError(error: unknown): MailboxError {
  if (error instanceof MailboxError) return error;
  const e = (error ?? {}) as SmtpFailure;
  const response = e.response ?? e.message ?? "";
  const firstLine = response.split(/\r?\n/)[0]?.trim() ?? "";
  const status = e.responseCode;

  if (e.code === "EAUTH" || status === 535) return new MailboxError("AUTH_REVOKED", "SMTP authentication failed", { detail: firstLine });
  if (e.code && NETWORK_CODES.test(e.code)) return new MailboxError("TRANSIENT", "SMTP server unreachable", { detail: e.code });
  if (status !== undefined && status >= 400 && status < 500) {
    // A 4xx is a temporary refusal; rate wording means we should slow down rather than just retry
    const limited = /limit|rate|too many/i.test(response);
    return new MailboxError(limited ? "RATE_LIMITED" : "TRANSIENT", "SMTP temporary failure", { detail: firstLine });
  }
  if (status !== undefined && status >= 500 && status < 600) {
    if (/quota|limit/i.test(response)) return new MailboxError("QUOTA", "SMTP quota reached", { detail: firstLine });
    return new MailboxError("REJECTED", "SMTP message rejected", { detail: firstLine });
  }
  return new MailboxError("TRANSIENT", "SMTP error", { detail: e.message });
}

async function safeTransport(creds: SmtpCredentials) {
  const target = await assertSafeMailHost({ host: creds.host, port: creds.port, kind: "smtp" });
  return createSmtpTransport(creds, target);
}

export async function sendViaSmtp(
  creds: SmtpCredentials,
  from: { address: string; name: string },
  message: OutboundMessage,
): Promise<SendResult> {
  const transporter = await safeTransport(creds);
  try {
    await transporter.sendMail({
      from,
      to: message.to.name ? { address: message.to.address, name: message.to.name } : message.to.address,
      subject: message.subject,
      text: message.text,
      html: message.html,
      messageId: message.messageId,
      inReplyTo: message.inReplyTo ?? undefined,
      references: message.references?.length ? message.references : undefined,
      headers: message.headers,
    });
  } catch (error) {
    throw mapSmtpError(error);
  } finally {
    transporter.close();
  }
  return { messageId: message.messageId, providerId: null, threadId: null };
}

export async function verifySmtp(creds: SmtpCredentials): Promise<void> {
  const transporter = await safeTransport(creds);
  try {
    await transporter.verify();
  } catch (error) {
    throw mapSmtpError(error);
  } finally {
    transporter.close();
  }
}
