/**
 * Is this reading worth interrupting the seller for a call? Pure.
 * Any reading shows up in the extension badge; only these become a
 * notification. The first matching reason wins, strongest first.
 */

export type CallMomentFacts = {
  /** Distinct people reading the link right now. */
  liveReaders: number;
  multiViewerThreshold: number;
  /** First real reading of the link. */
  firstOpen: boolean;
  /** Days since the previous reading, null when unknown or first one. */
  inactiveDays: number | null;
  reopenAfterDays: number;
  /** Time spent on pricing pages in this session, null when not checked. */
  pricingSeconds: number | null;
  pricingThresholdSec: number;
  /** Priority of the current deal analysis (5 = act today), null without one. */
  aiPriority: number | null;
};

export type CallMomentReason = "multi_viewer" | "reopened" | "pricing" | "first_open" | "hot_deal";

export type CallMoment = { reason: CallMomentReason; detail: string };

export function detectCallMoment(facts: CallMomentFacts): CallMoment | null {
  if (facts.liveReaders > facts.multiViewerThreshold) {
    return { reason: "multi_viewer", detail: `${facts.liveReaders} personnes lisent en même temps` };
  }
  if (facts.inactiveDays !== null && facts.inactiveDays >= facts.reopenAfterDays) {
    return { reason: "reopened", detail: `Revient après ${facts.inactiveDays} jours sans lecture` };
  }
  if (facts.pricingSeconds !== null && facts.pricingSeconds >= facts.pricingThresholdSec) {
    return { reason: "pricing", detail: "S'attarde sur les tarifs" };
  }
  if (facts.firstOpen) {
    return { reason: "first_open", detail: "Ouvre votre proposition pour la première fois" };
  }
  if (facts.aiPriority !== null && facts.aiPriority >= 4) {
    return { reason: "hot_deal", detail: "Deal chaud, en train de relire" };
  }
  return null;
}
