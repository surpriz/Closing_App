/**
 * The welcome tour at /bienvenue. Pure, and safe to import from client components.
 */

/** Same limit as the offer field in the settings. */
export const OFFER_DESCRIPTION_MAX = 1500;

export const MAIL_CLIENTS = ["gmail", "outlook_web", "outlook_desktop", "other"] as const;

export type MailClient = (typeof MAIL_CLIENTS)[number];

export const MAIL_CLIENT_LABELS: Record<MailClient, { title: string; hint: string }> = {
  gmail: { title: "Gmail", hint: "Dans Chrome ou Edge" },
  outlook_web: { title: "Outlook dans le navigateur", hint: "outlook.office.com, outlook.live.com" },
  outlook_desktop: { title: "Outlook installé", hint: "L'application sur Windows ou Mac" },
  other: { title: "Autre messagerie", hint: "Apple Mail, Thunderbird, téléphone…" },
};

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
 * Value first, tools last: the seller drops a real document and opens it as
 * their prospect would before anything about mailboxes or extensions.
 */
export const ONBOARDING_STEPS = ["value", "drop", "test", "daily"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  value: "Ce que fait Clozer",
  drop: "Votre document",
  test: "Côté prospect",
  daily: "Au quotidien",
};

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
