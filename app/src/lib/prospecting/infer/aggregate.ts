// From the seller's past deals to a target. Pure: no Prisma, no clock.
import { HEADCOUNT_BRACKETS, bracketIndex } from "../headcount";

export type DealCompany = {
  domain: string;
  /** Null when the registry did not recognize the domain. */
  company: { naf: string | null; headcountCode: string | null; region: string | null; departement: string | null } | null;
  /** 0 to 1, from the name match in the registry. */
  confidence: number;
  /** Best engagement score among the deals with this company, 0 to 100. */
  score: number;
  won: boolean;
};

export type InferredTarget = {
  nafCodes: string[];
  headcountCodes: string[];
  regions: string[];
  departements: string[];
  evidence: {
    domains: number;
    recognized: number;
    won: number;
    averageConfidence: number | null;
  };
};

const NAF_MIN_SHARE = 0.15;
const NAF_MAX = 5;
const HEADCOUNT_COVERAGE = 0.7;
const REGION_MIN_SHARE = 0.25;
const REGION_MAX = 3;
const DEPARTEMENT_MIN_SHARE = 0.2;

/** A company that read a lot, and above all one that signed, says more about the target. */
export function dealWeight(deal: Pick<DealCompany, "score" | "won" | "confidence">) {
  const engagement = 1 + Math.max(0, Math.min(100, deal.score)) / 50;
  return (engagement + (deal.won ? 2 : 0)) * deal.confidence;
}

function shares(entries: [string, number][]) {
  const totals = new Map<string, number>();
  for (const [key, weight] of entries) totals.set(key, (totals.get(key) ?? 0) + weight);
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([key, weight]) => ({ key, share: sum > 0 ? weight / sum : 0 }))
    .sort((a, b) => b.share - a.share || a.key.localeCompare(b.key));
}

/** Smallest run of adjacent brackets that holds most of the weight. */
function headcountWindow(entries: [string, number][]) {
  const weights = HEADCOUNT_BRACKETS.map(() => 0);
  for (const [code, weight] of entries) {
    const index = bracketIndex(code);
    if (index >= 0) weights[index] += weight;
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  let best: { from: number; to: number; weight: number } | null = null;
  for (let from = 0; from < weights.length; from++) {
    let sum = 0;
    for (let to = from; to < weights.length; to++) {
      sum += weights[to];
      if (sum / total < HEADCOUNT_COVERAGE) continue;
      const width = to - from;
      const bestWidth = best ? best.to - best.from : Infinity;
      if (width < bestWidth || (width === bestWidth && sum > best!.weight)) best = { from, to, weight: sum };
      break;
    }
  }
  return best ? HEADCOUNT_BRACKETS.slice(best.from, best.to + 1).map((b) => b.code) : [];
}

export function inferTarget(deals: DealCompany[]): InferredTarget {
  const known = deals.filter((deal) => deal.company && deal.confidence > 0);
  const weighted = known.map((deal) => ({ company: deal.company!, weight: dealWeight(deal) }));

  const naf = shares(weighted.filter((d) => d.company.naf).map((d) => [d.company.naf!, d.weight]));
  const nafCodes = naf.filter((n) => n.share >= NAF_MIN_SHARE).slice(0, NAF_MAX).map((n) => n.key);
  if (nafCodes.length === 0 && naf.length > 0) nafCodes.push(naf[0].key);

  const headcountCodes = headcountWindow(
    weighted.filter((d) => d.company.headcountCode).map((d) => [d.company.headcountCode!, d.weight]),
  );

  const regions = shares(weighted.filter((d) => d.company.region).map((d) => [d.company.region!, d.weight]))
    .filter((r) => r.share >= REGION_MIN_SHARE)
    .slice(0, REGION_MAX)
    .map((r) => r.key);
  // Customers all over the country: no place filter, unless a departement stands out
  const departements = regions.length
    ? []
    : shares(weighted.filter((d) => d.company.departement).map((d) => [d.company.departement!, d.weight]))
        .filter((d) => d.share >= DEPARTEMENT_MIN_SHARE)
        .map((d) => d.key);

  const confidences = known.map((deal) => deal.confidence);
  return {
    nafCodes,
    headcountCodes,
    regions,
    departements,
    evidence: {
      domains: deals.length,
      recognized: known.length,
      won: known.filter((deal) => deal.won).length,
      averageConfidence: confidences.length
        ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
        : null,
    },
  };
}
