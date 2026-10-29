export type MailboxErrorCode = "AUTH_REVOKED" | "QUOTA" | "RATE_LIMITED" | "REJECTED" | "TRANSIENT" | "CONFIG";

/**
 * Connector failure with a code the sender uses to decide: pause the mailbox, retry later, or drop the message.
 * `maybeSent`: the provider had accepted the request for transmission when it failed (5xx, unreadable answer, network
 * error or timeout), so the mail may have left; the sender must not retry it on its own.
 */
export class MailboxError extends Error {
  readonly maybeSent: boolean;

  constructor(
    readonly code: MailboxErrorCode,
    message: string,
    readonly options: { retryAfterMs?: number; detail?: string; maybeSent?: boolean } = {},
  ) {
    super(message);
    this.name = "MailboxError";
    this.maybeSent = options.maybeSent === true;
  }
}

export function isMailboxError(e: unknown): e is MailboxError {
  return e instanceof MailboxError;
}
