/**
 * Is this reading worth interrupting the seller for a call? Pure.
 * Any reading shows up in the extension badge; only these become a
 * notification. The first matching reason wins, strongest first. `detail`
 * is written for the seller, in their language.
 */

import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

export type CallMomentFacts = {
  /** Distinct people reading the link right now. */
  liveReaders: number;
  multiViewerThreshold: number;
  /** From this many readers it is a committee, raised by triggers/committee.ts instead. */
  committeeThreshold: number;
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

export function detectCallMoment(facts: CallMomentFacts, locale: UiLocale): CallMoment | null {
  const t = getNamespaceTranslator(locale, "alerts.callMoment");
  if (facts.liveReaders > facts.multiViewerThreshold && facts.liveReaders < facts.committeeThreshold) {
    return { reason: "multi_viewer", detail: t("multiViewer", { count: facts.liveReaders }) };
  }
  if (facts.inactiveDays !== null && facts.inactiveDays >= facts.reopenAfterDays) {
    return { reason: "reopened", detail: t("reopened", { days: facts.inactiveDays }) };
  }
  if (facts.pricingSeconds !== null && facts.pricingSeconds >= facts.pricingThresholdSec) {
    return { reason: "pricing", detail: t("pricing") };
  }
  if (facts.firstOpen) {
    return { reason: "first_open", detail: t("firstOpen") };
  }
  if (facts.aiPriority !== null && facts.aiPriority >= 4) {
    return { reason: "hot_deal", detail: t("hotDeal") };
  }
  return null;
}
