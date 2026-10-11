// Which registry result is the company we are looking for? Pure.
import { fold } from "../text";

// Legal forms and filler words that say nothing about which company it is
const NOISE = new Set([
  "sa", "sas", "sasu", "sarl", "eurl", "sci", "snc", "scop", "selarl", "sca", "ei", "eirl", "gie",
  "groupe", "group", "france", "societe", "ste", "et", "de", "des", "du", "la", "le", "les", "l", "d",
]);

function tokens(value: string) {
  return fold(value)
    .split(" ")
    .filter((token) => token && !NOISE.has(token));
}

/** 0 to 1: how much two company names look alike, ignoring legal forms and accents. */
export function nameSimilarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (left.length === 0 || right.length === 0) return 0;

  // "acmestudio" (from a domain) against "Acme Studio"
  if (left.join("") === right.join("")) return 1;

  const rightSet = new Set(right);
  const shared = left.filter((token) => rightSet.has(token)).length;
  return shared / Math.max(left.length, right.length);
}

export type RegistryCandidate = {
  siren: string;
  names: string[]; // legal name, acronym, trade names
  departement: string | null;
};

/**
 * Best candidate and how sure we are. The registry ranks by relevance, so on a tie the
 * first one wins. A departement that matches what we know adds confidence.
 */
export function pickCompany(
  query: { name: string; departement?: string | null },
  candidates: RegistryCandidate[],
): { siren: string; confidence: number } | null {
  let best: { siren: string; score: number } | null = null;

  for (const candidate of candidates) {
    const similarity = Math.max(0, ...candidate.names.map((name) => nameSimilarity(query.name, name)));
    const place = query.departement && candidate.departement === query.departement ? 0.1 : 0;
    const score = similarity + place;
    if (!best || score > best.score) best = { siren: candidate.siren, score };
  }

  return best && best.score >= 0.5 ? { siren: best.siren, confidence: Math.min(1, best.score) } : null;
}

/** "acme-studio.fr" → "acme studio": what to type in the registry search. */
export function nameFromDomain(domain: string) {
  const labels = domain.toLowerCase().replace(/^www\./, "").split(".");
  const main = labels.length >= 3 && ["co", "com"].includes(labels.at(-2) ?? "") ? labels.at(-3) : labels.at(-2);
  return main ? main.replace(/[-_]+/g, " ").trim() || null : null;
}
