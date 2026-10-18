/**
 * The welcome tour at /welcome. Pure, and safe to import from client components.
 */

/** Same limit as the offer field in the settings. */
export const OFFER_DESCRIPTION_MAX = 1500;

export const MAIL_CLIENTS = ["gmail", "outlook_web", "outlook_desktop", "other"] as const;

export type MailClient = (typeof MAIL_CLIENTS)[number];

export function parseMailClient(value: unknown): MailClient | null {
  return MAIL_CLIENTS.includes(value as MailClient) ? (value as MailClient) : null;
}

export type MailTool = "chrome" | "outlook_addin" | "manual";

/** What turns a PDF attachment into a Clozer link, for this mailbox. */
export function toolFor(client: MailClient | null): MailTool {
  if (client === "gmail" || client === "outlook_web") return "chrome";
  if (client === "outlook_desktop") return "outlook_addin";
  return "manual";
}

/** Nothing to install for a manual send; otherwise, is the right tool paired? */
export function isToolConnected(client: MailClient | null, connected: { chrome: boolean; outlook: boolean }) {
  const tool = toolFor(client);
  if (tool === "chrome") return connected.chrome;
  if (tool === "outlook_addin") return connected.outlook;
  return true;
}

export type MailToolTipKind = "chrome" | "outlook_addin" | "unknown";

/**
 * The tool worth suggesting on the share screen, or null when there is none:
 * already paired, or a mailbox Clozer can't plug into. "unknown" when the
 * mailbox isn't known and nothing is paired yet.
 */
export function mailToolTip(
  client: MailClient | null,
  connected: { chrome: boolean; outlook: boolean },
): MailToolTipKind | null {
  if (!client) return connected.chrome || connected.outlook ? null : "unknown";
  const tool = toolFor(client);
  if (tool === "manual" || isToolConnected(client, connected)) return null;
  return tool;
}

/**
 * The Chrome extension only installs from a desktop Chromium browser (Chrome,
 * Edge, Brave…). Chrome on iOS says CriOS, not Chrome/, and can't take it either.
 */
export function canInstallChromeExtension(userAgent: string) {
  return /Chrome\//.test(userAgent) && !/Mobi|Android|iPhone|iPad/i.test(userAgent);
}

/** The extension's answer to "clozer:status", from 1.2.0 on. */
export type ExtensionReply = { version: string; signedIn: boolean; email: string | null };

export type ExtensionState = "absent" | "signed_out" | "other_account" | "outdated" | "ok";

/** What the server knows, for the browser to find out the rest. */
export type ExtensionProbe = {
  ids: string[];
  minVersion: string | null;
  userEmail: string;
  /** A live Chrome token somewhere: vouches for versions that can't answer. */
  serverChrome: boolean;
};

export function isOlderVersion(version: string, min: string) {
  const a = version.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

/**
 * Where this browser's extension stands. No reply means no extension, or one
 * older than 1.2.0 that can't hear the app: a live Chrome token then vouches for it.
 */
export function extensionState({
  reply,
  userEmail,
  minVersion,
  serverChrome,
}: {
  reply: ExtensionReply | null;
  userEmail: string;
  minVersion: string | null;
  serverChrome: boolean;
}): ExtensionState {
  if (!reply) return serverChrome ? "ok" : "absent";
  if (minVersion && isOlderVersion(reply.version, minVersion)) return "outdated";
  if (!reply.signedIn) return "signed_out";
  if (reply.email && reply.email.toLowerCase() !== userEmail.toLowerCase()) return "other_account";
  return "ok";
}

/** The dashboard banner comes back a week after the seller closed it. */
export const EXTENSION_NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isExtensionNudgeSnoozed(hiddenAt: Date | null, now: Date) {
  return hiddenAt !== null && now.getTime() - hiddenAt.getTime() < EXTENSION_NUDGE_SNOOZE_MS;
}

/**
 * Value by doing, tools last: the seller drops a real document straight away and
 * opens it as their prospect would before anything about mailboxes or extensions.
 */
// Drop, read it as the prospect, then plug the mailbox in (the extension, for links without copy-paste)
export const ONBOARDING_STEPS = ["drop", "test", "daily"] as const;

/**
 * A path inside the app to come back to, never another site: one leading slash, then no slash
 * or backslash (browsers read "/\\x" as "//x"), and no backslash, space or control anywhere.
 */
export function safeReturnTo(value: unknown) {
  return typeof value === "string" && /^\/(?![/\\])[^\\\s\u0000-\u001f]*$/.test(value) ? value : null;
}

/** The tour's ready-made quote, for a seller with no document at hand. Never offered as theirs. */
export const SAMPLE_DOCUMENT = { url: "/onboarding/exemple-devis.pdf", name: "Devis exemple.pdf" };

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Name of the link the seller opens during the tour. */
export function testLinkName(documentName: string) {
  return `Test · ${documentName}`.slice(0, 200);
}

/**
 * During the tour the seller reads their own test link, often in the same
 * browser: their view is flagged fromSeller (isBot too) and still counts here.
 * A crawler is isBot without being the seller.
 */
export function isTestRead(view: { isBot: boolean; fromSeller: boolean }) {
  return view.fromSeller || !view.isBot;
}

/** Forced once: a fresh seller who has not seen the tour, in a workspace with nothing in it yet. */
export function shouldForceOnboarding(input: { onboardingCompletedAt: Date | null; documentCount: number }) {
  return !input.onboardingCompletedAt && input.documentCount === 0;
}
