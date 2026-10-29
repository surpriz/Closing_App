import { getPublicAppUrl } from "@/lib/app-origin";
import { getEnv } from "@/lib/env";

type Env = ReturnType<typeof getEnv>;

/** Which Gmail connector new mailboxes get. An explicit GMAIL_CONNECTOR wins, else whichever one is fully configured. */
export function gmailConnector(env: Env = getEnv()): "UNIPILE" | "NYLAS" | null {
  const unipile = !!env.UNIPILE_DSN && !!env.UNIPILE_API_KEY;
  const nylas = !!env.NYLAS_CLIENT_ID && !!env.NYLAS_API_KEY;
  if (env.GMAIL_CONNECTOR === "unipile") return unipile ? "UNIPILE" : null;
  if (env.GMAIL_CONNECTOR === "nylas") return nylas ? "NYLAS" : null;
  if (unipile) return "UNIPILE";
  if (nylas) return "NYLAS";
  return null;
}

export function isMicrosoftMailboxConfigured(env: Env = getEnv()): boolean {
  return !!env.MICROSOFT_MAILBOX_CLIENT_ID && !!env.MICROSOFT_MAILBOX_CLIENT_SECRET;
}

/** Providers only call back over https, and the shared token must exist; otherwise we poll. */
export function mailboxWebhooksEnabled(env: Env = getEnv()): boolean {
  return !!env.MAILBOX_WEBHOOK_TOKEN && getPublicAppUrl().startsWith("https://");
}

export function mailboxWebhookUrl(connector: "microsoft" | "unipile" | "nylas"): string {
  const token = getEnv().MAILBOX_WEBHOOK_TOKEN ?? "";
  return `${getPublicAppUrl()}/api/webhooks/mailboxes/${connector}?token=${encodeURIComponent(token)}`;
}

export function oauthCallbackUrl(provider: "microsoft" | "gmail"): string {
  return `${getPublicAppUrl()}/api/mailboxes/${provider}/callback`;
}
