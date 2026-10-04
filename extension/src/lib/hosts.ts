import type { MailHost } from "./messages";

// Mail hosts the content scripts run on (Gmail, Outlook for work and personal accounts)
export const MAIL_MATCHES = [
  "https://mail.google.com/*",
  "https://outlook.office.com/*",
  "https://outlook.office365.com/*",
  "https://outlook.live.com/*",
  "https://outlook.cloud.microsoft/*",
];

export function mailHost(hostname: string): MailHost | null {
  if (hostname === "mail.google.com") return "gmail";
  if (/^outlook\.(office|office365|live)\.com$|^outlook\.cloud\.microsoft$/.test(hostname)) return "outlook";
  return null;
}
