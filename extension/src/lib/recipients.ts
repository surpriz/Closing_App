export type Recipient = { email: string; displayName: string | null };

const EMAIL = /[^\s@<>"',;:()]+@[^\s@<>"',;:()]+\.[a-z]{2,}/i;

export function extractEmail(value: string | null | undefined) {
  return value?.match(EMAIL)?.[0].toLowerCase() ?? null;
}

// Mail clients show "Marie Dupont", "Marie Dupont <marie@acme.fr>" or just the address
export function toRecipient(email: string | null, label?: string | null): Recipient | null {
  const address = extractEmail(email) ?? extractEmail(label);
  if (!address) return null;
  const name = label
    ?.replace(/<[^>]*>/g, "")
    .replace(EMAIL, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
  return { email: address, displayName: name || null };
}
