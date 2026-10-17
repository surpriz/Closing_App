import type { EngagementTier } from "@/generated/prisma/enums";
import { maybeT, type AppT } from "@/lib/closing/dashboard/i18n";

export type VerdictInput = {
  /** The AI reading of the deal, when there is one. */
  insight: { headline: string; summary: string } | null;
  score: { tier: EngagementTier; score: number; reasons: { code: string; weight: number }[] } | null;
  /** At least one real reading session. */
  opened: boolean;
};

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * The one sentence at the top of a deal: the AI reading, else the temperature and what made it.
 * `t` is the root translator (tier and reasons come from "labels").
 */
export function dealVerdict(input: VerdictInput, t: AppT): { headline: string; detail: string | null } {
  if (input.insight) return { headline: input.insight.headline, detail: input.insight.summary };
  if (!input.opened) return { headline: t("common.verdict.notOpened"), detail: t("common.verdict.notOpenedDetail") };
  if (!input.score) return { headline: t("common.verdict.opened"), detail: t("common.verdict.openedDetail") };

  const tier = t(`labels.tier.${input.score.tier}`);
  const reasons = [...input.score.reasons]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((reason) => lowerFirst(maybeT(t, `labels.scoreReason.${reason.code}`, reason.code)));
  const why = reasons.length > 0 ? reasons.join(", ") : t("common.verdict.noRecentRead");
  return { headline: t("common.verdict.headline", { tier, why }), detail: null };
}
