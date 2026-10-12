import type { EngagementTier } from "@/generated/prisma/enums";

export type VerdictInput = {
  /** The AI reading of the deal, when there is one. */
  insight: { headline: string; summary: string } | null;
  score: { tier: EngagementTier; score: number; reasons: { code: string; weight: number }[] } | null;
  /** At least one real reading session. */
  opened: boolean;
};

export type VerdictLabels = {
  tier: Record<EngagementTier, string>;
  reason: Record<string, string>;
};

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The one sentence at the top of a deal: the AI reading, else the temperature and what made it. */
export function dealVerdict(input: VerdictInput, labels: VerdictLabels): { headline: string; detail: string | null } {
  if (input.insight) return { headline: input.insight.headline, detail: input.insight.summary };
  if (!input.opened) return { headline: "Pas encore ouvert.", detail: "Le verdict arrive dès la première lecture." };
  if (!input.score) return { headline: "Ouvert.", detail: "Le verdict arrive dès que Clozer a lu ce deal." };

  const tier = labels.tier[input.score.tier];
  const reasons = [...input.score.reasons]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((reason) => lowerFirst(labels.reason[reason.code] ?? reason.code));
  const why = reasons.length > 0 ? reasons.join(", ") : "aucune lecture récente";
  return { headline: `${tier} : ${why}.`, detail: null };
}
