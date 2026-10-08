import { INSIGHT_ACTION_LABELS, TIMING_LABELS } from "@/components/dashboard/labels";

import { computeNextAction, withAiAdvice, type NextAction } from "./next-action";
import type { OpenDeal } from "./queries";

/**
 * What to do about one open deal, as the "À traiter" list and the morning
 * digest show it: the rules, overridden by a current deal analysis. Pure.
 */
export function dealAction(deal: OpenDeal, now: Date, readingNow: boolean) {
  const ai = currentInsight(deal);
  const tier = deal.opened ? (deal.engagementScore?.tier ?? null) : null;
  const action: NextAction = withAiAdvice(
    computeNextAction({
      now,
      dealStatus: deal.dealStatus,
      readingNow,
      opened: deal.opened,
      tier,
      pricingFocus: deal.pricingFocus,
      lastActivityAt: deal.lastActivityAt,
      sentAt: deal.sentAt ?? deal.createdAt,
      followupsEnabled: deal.followupsEnabled,
      nextFollowup: deal.followups[0] ?? null,
      draftToReview: deal.draftCount > 0,
      lastSellerContactAt: deal.lastSellerContactAt,
      snoozedUntil: deal.snoozedUntil,
    }),
    ai.advice,
    { action: INSIGHT_ACTION_LABELS, timing: TIMING_LABELS },
  );
  return {
    action,
    tier,
    score: deal.opened ? (deal.engagementScore?.score ?? 0) : 0,
    insightHeadline: ai.insightHeadline,
    aiPriority: ai.aiPriority,
  };
}

// An analysis older than the last reading no longer describes the deal
function currentInsight(deal: OpenDeal) {
  const current = deal.insight && (!deal.lastActivityAt || deal.insight.createdAt >= deal.lastActivityAt);
  const action = deal.insight?.recommendedAction as { type: string; timing: string } | undefined;
  return {
    insightHeadline: current ? deal.insight!.headline : null,
    aiPriority: current ? deal.insight!.priority : null,
    advice: current && action ? { type: action.type, timing: action.timing, priority: deal.insight!.priority } : null,
  };
}
