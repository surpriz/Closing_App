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

export const ONBOARDING_STEPS = ["principle", "mail", "install", "daily", "start"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  principle: "Le principe",
  mail: "Votre messagerie",
  install: "L'outil",
  daily: "Au quotidien",
  start: "C'est parti",
};
