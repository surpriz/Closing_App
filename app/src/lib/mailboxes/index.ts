import { randomBytes } from "node:crypto";

import type { Mailbox } from "@/generated/prisma/client";

import { decodeCredentials } from "./credentials";
import { MailboxError } from "./errors";
import { imapConnector } from "./imap";
import type { MailboxConnector } from "./types";

export function connectorFor(
  mailbox: Pick<Mailbox, "id" | "provider" | "connector" | "email" | "displayName" | "credentials">,
): MailboxConnector {
  switch (mailbox.connector) {
    case "SMTP": {
      const creds = decodeCredentials(mailbox.credentials);
      if (creds.kind !== "imap") throw new MailboxError("CONFIG", "credentials do not match the SMTP connector");
      return imapConnector(mailbox, creds);
    }
    case "GRAPH":
    case "UNIPILE":
    case "NYLAS":
      // Arrives with lot 4
      throw new MailboxError("CONFIG", "connector not available yet");
  }
}

/** Our own Message-ID, so replies and bounces can be matched back without asking the provider. */
export function generateMessageId(domain: string): string {
  return `<${Date.now().toString(36)}.${randomBytes(12).toString("base64url")}@${domain}>`;
}

export function messageIdDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}
