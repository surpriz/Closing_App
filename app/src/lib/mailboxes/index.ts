import { randomBytes } from "node:crypto";

import type { Mailbox } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";

import { decodeCredentials } from "./credentials";
import { MailboxError } from "./errors";
import { nylasConnector } from "./gmail/nylas";
import { unipileConnector } from "./gmail/unipile";
import { imapConnector } from "./imap";
import { graphConnector } from "./microsoft/graph";
import type { MailboxConnector } from "./types";

export type ConnectorDeps = {
  /** Called when a connector rotates its credentials (refresh token), with the freshly encoded blob */
  persistCredentials?: (encoded: string) => Promise<void>;
  http?: typeof fetch;
};

export type ConnectorMailbox = Pick<Mailbox, "id" | "provider" | "connector" | "email" | "displayName" | "credentials"> &
  Partial<Pick<Mailbox, "externalAccountId" | "subscriptionId">>;

/** Default rotation hook: writes the new encoded credentials straight back to the mailbox row. */
export function defaultPersist(mailboxId: string): (encoded: string) => Promise<void> {
  return async (encoded) => {
    await prisma.mailbox.update({ where: { id: mailboxId }, data: { credentials: encoded } });
  };
}

export function connectorFor(mailbox: ConnectorMailbox, deps: ConnectorDeps = {}): MailboxConnector {
  switch (mailbox.connector) {
    case "SMTP": {
      const creds = decodeCredentials(mailbox.credentials);
      if (creds.kind !== "imap") throw new MailboxError("CONFIG", "credentials do not match the SMTP connector");
      return imapConnector(mailbox, creds);
    }
    case "GRAPH": {
      const creds = decodeCredentials(mailbox.credentials);
      if (creds.kind !== "microsoft") throw new MailboxError("CONFIG", "credentials do not match the Graph connector");
      return graphConnector(mailbox, creds, { ...deps, persistCredentials: deps.persistCredentials ?? defaultPersist(mailbox.id) });
    }
    case "UNIPILE": {
      const creds = decodeCredentials(mailbox.credentials);
      if (creds.kind !== "unipile") throw new MailboxError("CONFIG", "credentials do not match the Unipile connector");
      return unipileConnector(mailbox, creds, deps);
    }
    case "NYLAS": {
      const creds = decodeCredentials(mailbox.credentials);
      if (creds.kind !== "nylas") throw new MailboxError("CONFIG", "credentials do not match the Nylas connector");
      return nylasConnector(mailbox, creds, deps);
    }
  }
}

/** Our own Message-ID, so replies and bounces can be matched back without asking the provider. */
export function generateMessageId(domain: string): string {
  return `<${Date.now().toString(36)}.${randomBytes(12).toString("base64url")}@${domain}>`;
}

export function messageIdDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}
