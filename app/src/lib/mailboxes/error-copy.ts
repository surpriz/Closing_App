import type { MailboxProvider } from "@/generated/prisma/enums";

/**
 * Which sentence a mailbox error gets. `Mailbox.lastError` codes are provider-agnostic; the seller is not:
 * a Google or Microsoft mailbox has no password to retype, the provider revoked an OAuth grant.
 */
export function mailboxErrorKey<C extends string>(code: C, provider: MailboxProvider): C | "AUTH_REVOKED_OAUTH" {
  if (code === "AUTH_REVOKED" && provider !== "IMAP") return "AUTH_REVOKED_OAUTH";
  return code;
}

/** The provider as the seller names it. */
export function providerLabel(provider: MailboxProvider): "Google" | "Microsoft" | "IMAP" {
  return provider === "GOOGLE" ? "Google" : provider === "MICROSOFT" ? "Microsoft" : "IMAP";
}
