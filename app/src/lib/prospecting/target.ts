// The seller's target, as filters shared by every provider. Pure.
import { z } from "zod";

import { isDepartementCode, REGIONS, regionName } from "./geo";
import { formatHeadcountRange, HEADCOUNT_BRACKETS, headcountRanges } from "./headcount";
import { nafDivision, nafLabel, normalizeNafCode } from "./naf";

/** Apollo's seniority vocabulary, used as the common one. */
export const SENIORITIES = ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager"] as const;
export type Seniority = (typeof SENIORITIES)[number];

/** Who can sign: a "decision maker" in the provider comparison. */
export const DECISION_SENIORITIES = new Set<string>(["owner", "founder", "c_suite", "partner", "vp", "head", "director"]);

export const SENIORITY_LABELS: Record<Seniority, string> = {
  owner: "Gérant",
  founder: "Fondateur",
  c_suite: "Direction générale",
  partner: "Associé",
  vp: "VP",
  head: "Responsable",
  director: "Directeur",
  manager: "Manager",
};

// First match wins: "Directeur général" is c_suite before being a director
const TITLE_SENIORITY: [RegExp, Seniority][] = [
  [/\b(fondat|founder|co-?founder)/i, "founder"],
  [/\b(ceo|cto|cfo|coo|cmo|cio|pdg|p\.?d\.?g|president|président|directeur g[ée]n[ée]ral|directrice g[ée]n[ée]rale|dg\b|chief)/i, "c_suite"],
  [/\b(g[ée]rant|owner|propri[ée]taire)/i, "owner"],
  [/\b(associ[ée]|partner)/i, "partner"],
  [/\b(vp|vice[- ]pr[ée]sident)/i, "vp"],
  [/\b(directeur|directrice|director)/i, "director"],
  [/\b(head|responsable)/i, "head"],
  [/\b(manager)/i, "manager"],
];

/** Apollo's search gives no seniority, only a title: guess it for the comparison. */
export function seniorityFromTitle(title: string | null | undefined): Seniority | null {
  if (!title) return null;
  return TITLE_SENIORITY.find(([pattern]) => pattern.test(title))?.[1] ?? null;
}

const words = (max: number, length = 80) =>
  z
    .array(z.string().trim().min(1).max(length))
    .max(max)
    .transform((items) => [...new Set(items)]);

export const targetFiltersSchema = z.object({
  nafCodes: words(20, 10).transform((codes) => [
    ...new Set(codes.map(normalizeNafCode).filter((c): c is string => !!c)),
  ]),
  keywords: words(10),
  headcountCodes: words(14, 10).transform((codes) =>
    codes.filter((code) => HEADCOUNT_BRACKETS.some((b) => b.code === code)),
  ),
  regions: words(18, 10).transform((codes) => codes.filter((code) => code in REGIONS)),
  departements: words(30, 10).transform((codes) => [
    ...new Set(codes.map((c) => c.toUpperCase()).filter(isDepartementCode)),
  ]),
  jobTitles: words(15),
  seniorities: words(8, 40).transform((items) => items.filter((s) => (SENIORITIES as readonly string[]).includes(s))),
  excludedDomains: words(50, 120).transform((items) => [
    ...new Set(items.map((d) => d.toLowerCase().replace(/^www\./, ""))),
  ]),
});

export type TargetFilters = z.output<typeof targetFiltersSchema>;

export const EMPTY_TARGET: TargetFilters = {
  nafCodes: [],
  keywords: [],
  headcountCodes: [],
  regions: [],
  departements: [],
  jobTitles: [],
  seniorities: [],
  excludedDomains: [],
};

/** "agence web, studio\nconseil" → ["agence web", "studio", "conseil"]: lists typed in a text field. */
export function splitList(text: string | null | undefined) {
  return (text ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** A search needs at least a sector and someone to look for. */
export function targetIsSearchable(target: TargetFilters) {
  const sector = target.nafCodes.length > 0 || target.keywords.length > 0;
  const people = target.jobTitles.length > 0 || target.seniorities.length > 0;
  return sector && people;
}

/** Words the provider understands: the seller's keywords, then the NAF labels. */
export function searchKeywords(target: TargetFilters) {
  const labels = target.nafCodes.map(nafLabel).filter((label): label is string => !!label);
  return [...new Set([...target.keywords, ...labels])];
}

/** "Programmation et conseil informatique · 10-49 salariés · Auvergne-Rhône-Alpes" */
export function describeTarget(target: TargetFilters) {
  const sectors = target.keywords.length
    ? target.keywords
    : [...new Set(target.nafCodes.map((code) => nafLabel(code) ?? code))];
  const sizes = headcountRanges(target.headcountCodes).map(formatHeadcountRange);
  const places = [
    ...target.regions.map((code) => regionName(code) ?? code),
    ...target.departements.map((code) => `dép. ${code}`),
  ];
  return [sectors.join(", "), sizes.join(", "), places.join(", ")].filter(Boolean).join(" · ");
}

export type CompanyFacts = {
  naf: string | null;
  region: string | null;
  departement: string | null;
};

/**
 * Does a company found by the provider fit the target, according to the registry?
 * "unknown" when the registry could not tell: the suggestion is kept with a warning.
 */
export function companyFit(company: CompanyFacts | null, target: TargetFilters): "match" | "off_target" | "unknown" {
  if (!company?.naf) return "unknown";

  if (target.nafCodes.length > 0) {
    const divisions = new Set(target.nafCodes.map(nafDivision));
    if (!divisions.has(nafDivision(company.naf))) return "off_target";
  }

  const places = target.regions.length > 0 || target.departements.length > 0;
  if (places && (company.region || company.departement)) {
    const inRegion = !!company.region && target.regions.includes(company.region);
    const inDepartement = !!company.departement && target.departements.includes(company.departement);
    if (!inRegion && !inDepartement) return "off_target";
  }

  return "match";
}
