// Side-by-side numbers for the providers on the same target. Pure.
import { DECISION_SENIORITIES } from "./target";

export type MetricSuggestion = {
  provider: string;
  seniority: string | null;
  nafVerified: boolean | null;
  status: string;
  invalidReason: string | null;
};

export type MetricCredit = { provider: string; kind: "SEARCH" | "REVEAL" | "DELIVERED"; credits: number };

export type ProviderMetrics = {
  provider: string;
  found: number;
  decisionMakerRate: number | null;
  verifiedCompanyRate: number | null;
  revealed: number;
  validEmailRate: number | null;
  creditsSpent: number;
  delivered: number;
  creditsPerDelivered: number | null;
};

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

// Duplicates, opt-outs and personal mailboxes say nothing about the provider's email quality
const PROVIDER_FAILURES = new Set(["NOT_FOUND", "UNVERIFIED"]);

export function providerMetrics(suggestions: MetricSuggestion[], credits: MetricCredit[]): ProviderMetrics[] {
  const providers = [...new Set([...suggestions.map((s) => s.provider), ...credits.map((c) => c.provider)])].sort();

  return providers.map((provider) => {
    const mine = suggestions.filter((s) => s.provider === provider);
    const checked = mine.filter((s) => s.nafVerified !== null);
    const ready = mine.filter((s) => s.status === "READY").length;
    const failed = mine.filter((s) => s.status === "INVALID" && PROVIDER_FAILURES.has(s.invalidReason ?? "")).length;
    const spent = credits
      .filter((c) => c.provider === provider && c.kind !== "DELIVERED")
      .reduce((sum, c) => sum + c.credits, 0);
    const delivered = credits
      .filter((c) => c.provider === provider && c.kind === "DELIVERED")
      .reduce((sum, c) => sum + c.credits, 0);

    return {
      provider,
      found: mine.length,
      decisionMakerRate: rate(mine.filter((s) => s.seniority && DECISION_SENIORITIES.has(s.seniority)).length, mine.length),
      verifiedCompanyRate: rate(checked.filter((s) => s.nafVerified).length, checked.length),
      revealed: ready + failed,
      validEmailRate: rate(ready, ready + failed),
      creditsSpent: spent,
      delivered,
      creditsPerDelivered: delivered > 0 ? spent / delivered : null,
    };
  });
}
