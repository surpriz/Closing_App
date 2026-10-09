import type { ProspectRole } from "@/generated/prisma/enums";

/**
 * Who a reader is in the buying committee. Pure. The seller's tag wins; without
 * one, the role is guessed from the email and name ("cfo@", "pierre.daf@",
 * "Directrice Générale"). The guess runs on every read, never stored, so it
 * improves with this list.
 */

const FINANCE = new Set([
  "cfo", "daf", "raf", "finance", "finances", "financier", "financiere", "compta", "comptabilite",
  "accounting", "achat", "achats", "acheteur", "acheteuse", "procurement", "purchasing", "buyer",
  "tresorerie", "treasury",
]);

const DECISION_MAKER = new Set([
  "ceo", "pdg", "dg", "dga", "president", "presidente", "fondateur", "fondatrice", "founder",
  "cofounder", "owner", "gerant", "gerante", "direction", "directeur", "directrice", "director",
  "coo", "cto", "cio", "dsi", "vp", "svp", "evp", "chief",
]);

const DECISION_MAKER_PHRASES = ["directeur general", "directrice generale", "managing director", "general manager", "co founder"];

const TECHNICAL = new Set(["it", "tech", "dev", "informatique", "engineering"]);

// Shared mailboxes: whoever reads them, the address says nothing about a role
const GENERIC = new Set(["contact", "info", "hello", "bonjour", "admin", "sales", "team", "noreply"]);

function words(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[._+\-\s\d]+/)
    .filter(Boolean);
}

export function classifyRole(input: { email: string | null; name: string | null }): ProspectRole | null {
  const local = input.email?.split("@")[0] ?? "";
  const localWords = words(local);
  if (localWords.length === 1 && GENERIC.has(localWords[0])) return null;

  const all = [...localWords, ...words(input.name ?? "")];
  const text = all.join(" ");
  if (all.some((w) => FINANCE.has(w))) return "FINANCE";
  if (all.some((w) => DECISION_MAKER.has(w)) || DECISION_MAKER_PHRASES.some((p) => ` ${text} `.includes(` ${p} `))) {
    return "DECISION_MAKER";
  }
  if (all.some((w) => TECHNICAL.has(w))) return "TECHNICAL";
  return null;
}

export type EffectiveRole = { role: ProspectRole; source: "seller" | "detected" };

/** The seller's tag, else the guess. Tagging OTHER silences a wrong guess. */
export function effectiveRole(p: { role: ProspectRole | null; email: string | null; name: string | null }): EffectiveRole | null {
  if (p.role) return { role: p.role, source: "seller" };
  const guess = classifyRole(p);
  return guess ? { role: guess, source: "detected" } : null;
}

/** Roles that sign or hold the budget: worth telling the seller about. */
export function isDecisionRole(role: ProspectRole | null | undefined) {
  return role === "DECISION_MAKER" || role === "FINANCE";
}
