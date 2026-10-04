import { DEEP_READ } from "../constants";

/**
 * The funnel follows a cohort: links sent in the period, and how far each one
 * went since. Every step is a subset of the previous one, so the bars never
 * grow from one step to the next.
 */

export type FunnelLinkFacts = {
  /** Null for web documents. */
  numPages: number | null;
  /** Non-bot reading sessions. */
  viewCount: number;
  maxPageReached: number;
  totalDurationMs: number;
  /** The score already flagged a long read of the pricing pages. */
  pricingFocus: boolean;
  /** VALIDATE_SIGN clicked, or deal marked validated / won. */
  validated: boolean;
};

export type Funnel = { sent: number; opened: number; deep: number; validated: number };

export function isDeepRead(link: FunnelLinkFacts): boolean {
  if (link.viewCount === 0) return false;
  if (link.pricingFocus) return true;
  if (!link.numPages) return link.totalDurationMs >= DEEP_READ.webMinMs;
  return (
    link.maxPageReached / link.numPages >= DEEP_READ.pdfCompletion &&
    link.totalDurationMs >= DEEP_READ.pdfMinMs
  );
}

export function buildFunnel(links: FunnelLinkFacts[]): Funnel {
  const funnel: Funnel = { sent: links.length, opened: 0, deep: 0, validated: 0 };
  for (const link of links) {
    // A deal validated without much reading (signed offline, marked won by
    // hand) still went through every step.
    if (link.validated) {
      funnel.opened++;
      funnel.deep++;
      funnel.validated++;
    } else if (link.viewCount > 0) {
      funnel.opened++;
      if (isDeepRead(link)) funnel.deep++;
    }
  }
  return funnel;
}

export type HeatDistribution = { HOT: number; WARM: number; COLD: number; unopened: number };

/** Open deals by temperature. A deal nobody read yet has no temperature. */
export function buildHeatDistribution(
  deals: { opened: boolean; tier: "HOT" | "WARM" | "COLD" | null }[],
): HeatDistribution {
  const distribution: HeatDistribution = { HOT: 0, WARM: 0, COLD: 0, unopened: 0 };
  for (const deal of deals) {
    if (!deal.opened) distribution.unopened++;
    else distribution[deal.tier ?? "COLD"]++;
  }
  return distribution;
}
