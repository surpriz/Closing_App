import type { PresetId } from "../presets";
import type { MailboxProvider } from "../types";

export type MxClassification = { provider: MailboxProvider; preset: PresetId | null; mxHost: string | null };

const RULES: { test: RegExp; provider: MailboxProvider; preset: PresetId | null }[] = [
  { test: /^(smtp\.google\.com|([a-z0-9-]+\.)*aspmx\.l\.google\.com)$/, provider: "GOOGLE", preset: "gmail-app-password" },
  { test: /\.mail\.protection\.outlook\.com$|\.mail\.eo\.outlook\.com$/, provider: "MICROSOFT", preset: null },
  { test: /^mx[0-4]\.mail\.ovh\.net$/, provider: "IMAP", preset: "ovh" },
  { test: /\.mail\.gandi\.net$/, provider: "IMAP", preset: "gandi" },
  { test: /^mx0[01]\.ionos\.[a-z.]+$|\.kundenserver\.de$|\.1and1\.[a-z.]+$/, provider: "IMAP", preset: "ionos" },
  { test: /\.infomaniak\.ch$/, provider: "IMAP", preset: "infomaniak" },
  { test: /\.o2switch\.net$/, provider: "IMAP", preset: "o2switch" },
];

/** Hosts come sorted by priority: the lowest one (first) decides. */
export function classifyMx(hosts: string[]): MxClassification {
  const mxHost = hosts[0]?.toLowerCase().replace(/\.$/, "") ?? null;
  if (!mxHost) return { provider: "IMAP", preset: null, mxHost: null };
  const rule = RULES.find((r) => r.test.test(mxHost));
  return { provider: rule?.provider ?? "IMAP", preset: rule?.preset ?? null, mxHost };
}

/** A consumer domain's DNS belongs to its provider: gmail.com, googlemail.com, outlook.com, hotmail.*, live.*. */
export function consumerProviderOf(domain: string): "google" | "microsoft" | null {
  const d = domain.toLowerCase();
  if (d === "gmail.com" || d === "googlemail.com") return "google";
  if (d === "outlook.com" || /^(hotmail|live)\./.test(d)) return "microsoft";
  return null;
}

/** Consumer domains are decided before the MX: their MX records say nothing useful about the account type. */
export function classifyDomain(domain: string, mxHosts: string[]): MxClassification {
  const consumer = consumerProviderOf(domain);
  const mxHost = mxHosts[0]?.toLowerCase() ?? null;
  if (consumer === "google") return { provider: "GOOGLE", preset: "gmail-app-password", mxHost };
  if (consumer === "microsoft") return { provider: "MICROSOFT", preset: null, mxHost };
  return classifyMx(mxHosts);
}
