/**
 * "marie@acme.com" → "m•••@acme.com". The gate greets the prospect the seller
 * sent the link to, but anyone holding the link sees that screen: the domain
 * is enough to recognise yourself, not to learn someone's address.
 */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  return `${local[0]}•••@${domain}`;
}
