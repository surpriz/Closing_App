// Turns an email recipient into prospect details. Pure: shared by the extension API and tests.

// Personal mailboxes: the domain says nothing about the company
const FREE_MAIL = new Set([
  "gmail", "googlemail", "outlook", "hotmail", "live", "msn", "yahoo", "ymail",
  "icloud", "me", "mac", "aol", "orange", "wanadoo", "free", "sfr", "neuf",
  "laposte", "bbox", "gmx", "web", "proton", "protonmail", "pm", "yopmail",
  "mail", "zoho", "libero", "hey", "fastmail", "tutanota", "t-online",
]);

// Second-level public suffixes, so "acme.co.uk" gives "acme" and not "co"
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu", "gouv", "asso"]);

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) && email.length <= 254 ? email : null;
}

// "Marie Dupont <marie@acme.fr>", "\"Dupont, Marie\" <marie@acme.fr>" or a bare address
export function parseRecipient(raw: string) {
  const match = raw.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  const email = normalizeEmail(match ? match[2] : raw);
  if (!email) return null;

  const name = match?.[1].replace(/^["']|["']$/g, "").trim();
  return { email, displayName: name && name.toLowerCase() !== email ? name : null };
}

function organizationLabel(domain: string) {
  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const tld = labels.length - 1;
  const index = labels.length >= 3 && SECOND_LEVEL.has(labels[tld - 1]) ? tld - 2 : tld - 1;
  return labels[index] ?? null;
}

/** gmail.com, orange.fr…: the address belongs to a person, not to a company. */
export function isPersonalEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  const label = domain ? organizationLabel(domain) : null;
  return !label || FREE_MAIL.has(label);
}

export function companyFromEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const label = organizationLabel(domain);
  if (!label || FREE_MAIL.has(label)) return null;

  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Display name as typed in the mail client, unless it is just the address again
export function prospectFromRecipient(input: { email: string; displayName?: string | null }) {
  const email = normalizeEmail(input.email);
  if (!email) return null;
  const name = input.displayName?.trim().slice(0, 120) || null;
  return {
    email,
    name: name && !name.includes("@") ? name : null,
    company: companyFromEmail(email),
  };
}
