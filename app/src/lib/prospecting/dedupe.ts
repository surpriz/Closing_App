// Keys that recognize the same person across searches and providers. Pure.
import { fold } from "./text";

/**
 * First name + initial of the last name + company: what both providers give before a reveal
 * (Apollo masks the last name as "Hu***n"). Coarse on purpose: a false duplicate costs a
 * suggestion, a missed one costs a credit and annoys the person twice.
 */
export function personKey(input: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) {
  const first = fold(input.firstName ?? "");
  const initial = fold(input.lastName ?? "").charAt(0);
  const company = fold(input.companyName ?? "").replace(/ /g, "");
  if (!first || !initial || !company) return null;
  return `${first}|${initial}|${company}`;
}

/** "https://www.linkedin.com/in/Jane-Doe/?utm=x" → "linkedin.com/in/jane-doe" */
export function normalizeLinkedinUrl(url: string | null | undefined) {
  const match = url?.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return match ? `linkedin.com/in/${decodeURIComponent(match[1]).toLowerCase()}` : null;
}

/** "Marie Dupont" → { first: "Marie", last: "Dupont" } */
export function splitFullName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  return { first: parts[0], last: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

/** "Dupont" → "D****t", shown until the reveal. */
export function maskLastName(lastName: string | null | undefined) {
  const name = lastName?.trim();
  if (!name) return null;
  if (name.length <= 2) return `${name.charAt(0)}*`;
  return `${name.charAt(0)}${"*".repeat(Math.min(name.length - 2, 4))}${name.charAt(name.length - 1)}`;
}
