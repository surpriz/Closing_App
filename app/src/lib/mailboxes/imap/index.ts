import type { ImapCredentials } from "../credentials";
import { isMailboxError, MailboxError } from "../errors";
import type { MailboxConnector, VerifyResult } from "../types";
import { listNewImapMessages, verifyImap } from "./imap";
import { sendViaSmtp, verifySmtp } from "./smtp";

export function imapConnector(
  mailbox: { email: string; displayName: string | null },
  creds: ImapCredentials,
): MailboxConnector {
  const from = { address: mailbox.email, name: mailbox.displayName ?? mailbox.email };
  return {
    provider: "IMAP",
    capabilities: { customHeaders: true, listUnsubscribe: true, webhooks: false, threadId: false, ownMessageId: true },
    send: (message) => sendViaSmtp(creds.smtp, from, message),
    listNewMessages: (cursor, opts) => listNewImapMessages(creds.imap, cursor, opts),
    async verify(): Promise<VerifyResult> {
      try {
        await verifySmtp(creds.smtp);
        await verifyImap(creds.imap);
        return { ok: true, address: mailbox.email, displayName: mailbox.displayName };
      } catch (error) {
        // verifySmtp/verifyImap already translate; anything else is unexpected and still reported, never thrown
        const e = isMailboxError(error) ? error : new MailboxError("TRANSIENT", "verification failed");
        return { ok: false, code: e.code, message: e.options.detail ? `${e.message}: ${e.options.detail}` : e.message };
      }
    },
    async disconnect() {
      // Connections are opened per call, nothing to release
    },
  };
}
