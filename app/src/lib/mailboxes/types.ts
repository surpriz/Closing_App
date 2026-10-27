import type { MailboxErrorCode } from "./errors";

// Declared locally because the generated Prisma enums are not available to this module yet; the controller aligns
// them with "@/generated/prisma/enums" later. The connector union is named *Kind* to avoid clashing with the
// MailboxConnector interface below.
export type MailboxProvider = "GOOGLE" | "MICROSOFT" | "IMAP";
export type MailboxConnectorKind = "UNIPILE" | "NYLAS" | "GRAPH" | "SMTP";

export type Capabilities = {
  customHeaders: boolean;
  listUnsubscribe: boolean;
  webhooks: boolean;
  threadId: boolean;
  ownMessageId: boolean;
};

export type OutboundMessage = {
  to: { address: string; name?: string | null };
  subject: string;
  text: string;
  html: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
  replyToProviderId?: string | null;
  headers?: Record<string, string>;
  idempotencyKey: string;
};

export type SendResult = { messageId: string; providerId: string | null; threadId: string | null };

export type DsnDetails = {
  action: "failed" | "delayed" | "other";
  status: string | null;
  diagnostic: string | null;
  failedRecipient: string | null;
  originalMessageId: string | null;
};

export type InboundHeaders = Partial<
  Record<
    "auto-submitted" | "precedence" | "x-autoreply" | "x-autorespond" | "content-type" | "list-id" | "x-failed-recipients",
    string
  >
>;

export type InboundMessage = {
  id: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  from: { address: string; name: string | null };
  to: string[];
  subject: string | null;
  date: Date;
  textExcerpt: string | null;
  isDsn: boolean;
  dsn: DsnDetails | null;
  headers: InboundHeaders;
  threadId: string | null;
};

export type SyncCursor = string | null;

export type VerifyResult =
  | { ok: true; address: string; displayName: string | null }
  | { ok: false; code: MailboxErrorCode; message: string };

export interface MailboxConnector {
  readonly provider: MailboxProvider;
  readonly capabilities: Capabilities;
  send(message: OutboundMessage): Promise<SendResult>;
  listNewMessages(
    cursor: SyncCursor,
    opts: { limit: number; notBefore: Date; signal: AbortSignal },
  ): Promise<{ messages: InboundMessage[]; cursor: SyncCursor; hasMore: boolean }>;
  getMessage?(id: string): Promise<InboundMessage | null>;
  verify(): Promise<VerifyResult>;
  disconnect(): Promise<void>;
  subscribe?(input: { notificationUrl: string; clientState: string }): Promise<{ subscriptionId: string; expiresAt: Date }>;
  renew?(subscriptionId: string): Promise<{ expiresAt: Date }>;
  unsubscribe?(subscriptionId: string): Promise<void>;
}
