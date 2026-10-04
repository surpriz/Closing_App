import { formatRelative } from "@/lib/format";

import { DAY_MS } from "../constants";

/**
 * What the seller should do about one open deal, from what the prospect did.
 * Rules are checked in order, the first match wins. Pure: `now` is passed in.
 */

type Tier = "HOT" | "WARM" | "COLD";

export type NextActionInput = {
  now: Date;
  dealStatus: "OPEN" | "CHANGE_REQUESTED";
  readingNow: boolean;
  /** At least one non-bot reading session. */
  opened: boolean;
  tier: Tier | null;
  pricingFocus: boolean;
  lastActivityAt: Date | null;
  /** sentAt, or createdAt when the link was never marked sent. */
  sentAt: Date;
  followupsEnabled: boolean;
  nextFollowup: { scheduledFor: Date } | null;
};

export type NextAction =
  | { kind: "call_now" }
  | { kind: "reply" }
  | { kind: "call"; pricing: boolean }
  | { kind: "followup_planned"; at: Date; opened: boolean }
  | { kind: "nudge"; days: number; opened: boolean }
  | { kind: "wait"; days: number; opened: boolean; tier: Tier | null };

/** Most urgent first. */
const URGENCY: NextAction["kind"][] = ["call_now", "reply", "call", "nudge", "followup_planned", "wait"];

/** The seller has something to do, as opposed to waiting. */
export function isUrgent(action: NextAction) {
  return URGENCY.indexOf(action.kind) <= URGENCY.indexOf("nudge");
}

/** A prospect who read and went quiet this long needs a word from the seller. */
const QUIET_DAYS_BEFORE_NUDGE = 3;
/** Pricing read this recently is still worth a call. */
const PRICING_CALL_WINDOW_MS = 3 * DAY_MS;

function daysSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function computeNextAction(input: NextActionInput): NextAction {
  const { now } = input;
  if (input.readingNow) return { kind: "call_now" };
  if (input.dealStatus === "CHANGE_REQUESTED") return { kind: "reply" };

  if (!input.opened) {
    // Anti-ghosting follow-ups only exist for links never opened.
    if (input.nextFollowup) return { kind: "followup_planned", at: input.nextFollowup.scheduledFor, opened: false };
    const days = daysSince(input.sentAt, now);
    if (!input.followupsEnabled && days >= 2) return { kind: "nudge", days, opened: false };
    return { kind: "wait", days, opened: false, tier: null };
  }

  const recentPricing =
    input.pricingFocus &&
    input.lastActivityAt !== null &&
    now.getTime() - input.lastActivityAt.getTime() <= PRICING_CALL_WINDOW_MS;
  if (input.tier === "HOT" || recentPricing) return { kind: "call", pricing: recentPricing };

  if (input.nextFollowup) return { kind: "followup_planned", at: input.nextFollowup.scheduledFor, opened: true };

  const quietDays = input.lastActivityAt ? daysSince(input.lastActivityAt, now) : 0;
  if (quietDays >= QUIET_DAYS_BEFORE_NUDGE) return { kind: "nudge", days: quietDays, opened: true };
  return { kind: "wait", days: quietDays, opened: true, tier: input.tier };
}

export function describeNextAction(action: NextAction, now: Date): string {
  switch (action.kind) {
    case "call_now":
      return "Lecture en cours : appelez maintenant.";
    case "reply":
      return "Demande d'ajustement en attente : répondez.";
    case "call":
      return action.pricing ? "Longue lecture des tarifs : appelez." : "Lu de près : appelez aujourd'hui.";
    case "followup_planned":
      return `${action.opened ? "" : "Pas encore ouvert. "}Relance auto ${formatRelative(action.at, now)}.`;
    case "nudge":
      return action.opened
        ? `Plus de lecture depuis ${action.days} jours : relancez.`
        : `Pas ouvert depuis ${action.days} jours, relances auto coupées : relancez.`;
    case "wait":
      if (!action.opened) return action.days === 0 ? "Envoyé aujourd'hui, laissez venir." : "Pas encore ouvert.";
      return action.tier === "WARM" ? "Lecture régulière, rien à faire pour l'instant." : "Rien à faire pour l'instant.";
  }
}

/** Most urgent first, then hottest, then most recently active. */
export function compareByUrgency(
  a: { action: NextAction; score: number; lastActivityAt: Date | null },
  b: { action: NextAction; score: number; lastActivityAt: Date | null },
) {
  return (
    URGENCY.indexOf(a.action.kind) - URGENCY.indexOf(b.action.kind) ||
    b.score - a.score ||
    (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0)
  );
}
