export type MailboxErrorCode = "AUTH_REVOKED" | "QUOTA" | "RATE_LIMITED" | "REJECTED" | "TRANSIENT" | "CONFIG";

/** Connector failure with a code the sender uses to decide: pause the mailbox, retry later, or drop the message. */
export class MailboxError extends Error {
  constructor(
    readonly code: MailboxErrorCode,
    message: string,
    readonly options: { retryAfterMs?: number; detail?: string } = {},
  ) {
    super(message);
    this.name = "MailboxError";
  }
}

export function isMailboxError(e: unknown): e is MailboxError {
  return e instanceof MailboxError;
}
