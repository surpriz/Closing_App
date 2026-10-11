import { formatRelative } from "@/lib/format";

import { DAY_MS } from "../constants";

/**
 * What the seller should do about one open deal, from what the prospect did.
 * Rules are checked in order, the first match wins. Pure: `now` is passed in.
 */

type Tier = "HOT" | "WARM" | "COLD";

/** Deals still to act on. VALIDATED stays until the seller confirms the sale. */
export type OpenDealStatus = "OPEN" | "CHANGE_REQUESTED" | "VALIDATED";

export type NextActionInput = {
  now: Date;
  dealStatus: OpenDealStatus;
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
  /** A follow-up is written and waits for the seller's approval. */
  draftToReview: boolean;
  /** Last call, reply or meeting the seller logged. */
  lastSellerContactAt: Date | null;
  snoozedUntil: Date | null;
  /** The prospect booked a meeting from the viewer, and its start when the widget gave it. */
  meetingBookedAt?: Date | null;
  meetingAt?: Date | null;
  /** The prospect asked for a quote under a video pitch. */
  quoteRequestedAt?: Date | null;
};

export type NextAction =
  /** The prospect signed: one click to record the sale. */
  | { kind: "close_won" }
  | { kind: "call_now" }
  /** A change request, or a quote asked for and not answered yet. */
  | { kind: "reply"; quote?: boolean }
  | { kind: "review_draft" }
  | { kind: "call"; pricing: boolean }
  | { kind: "followup_planned"; at: Date; opened: boolean }
  | { kind: "nudge"; days: number; opened: boolean }
  | { kind: "wait"; days: number; opened: boolean; tier: Tier | null }
  | { kind: "in_touch"; at: Date }
  /** A meeting is in the seller's calendar: follow-ups stopped, nothing to chase. */
  | { kind: "meeting_booked"; at: Date; meetingAt: Date | null }
  | { kind: "snoozed"; until: Date }
  /** What the deal analysis recommends, when it is current. */
  | { kind: "ai_advice"; text: string; urgent: boolean };

/** Most urgent first. */
const URGENCY: NextAction["kind"][] = [
  "close_won",
  "call_now",
  "reply",
  "review_draft",
  "call",
  "ai_advice",
  "nudge",
  "followup_planned",
  "meeting_booked",
  "in_touch",
  "wait",
  "snoozed",
];

/** The seller has something to do, as opposed to waiting. */
export function isUrgent(action: NextAction) {
  if (action.kind === "ai_advice") return action.urgent;
  return URGENCY.indexOf(action.kind) <= URGENCY.indexOf("nudge");
}

/** Rule outcomes that describe a fact of the moment: they stay, whatever the analysis says. */
const FACTUAL: NextAction["kind"][] = [
  "close_won",
  "call_now",
  "reply",
  "review_draft",
  "meeting_booked",
  "in_touch",
  "snoozed",
];

/**
 * The analysis has the last word on what to do, except for facts of the
 * moment (someone reading now, a change request, a draft waiting, a pause).
 * Without it, the rules decide alone.
 */
export function withAiAdvice(
  action: NextAction,
  advice: { type: string; timing: string; priority: number } | null,
  labels: { action: Record<string, string>; timing: Record<string, string> },
): NextAction {
  if (!advice || FACTUAL.includes(action.kind)) return action;
  const verb = labels.action[advice.type] ?? advice.type;
  const text =
    advice.type === "wait"
      ? "Rien à faire pour l'instant, Clozer surveille."
      : advice.type === "close_lost"
        ? "Deal sans doute perdu : à classer ?"
        : `${verb} ${labels.timing[advice.timing] ?? ""}.`.replace(" .", ".");
  return { kind: "ai_advice", text, urgent: advice.priority >= 4 && advice.type !== "wait" };
}

/** A prospect who read and went quiet this long needs a word from the seller. */
const QUIET_DAYS_BEFORE_NUDGE = 3;
/** Pricing read this recently is still worth a call. */
const PRICING_CALL_WINDOW_MS = 3 * DAY_MS;
/** After a call or a reply logged by the seller, the ball is in the prospect's court for a while. */
const IN_TOUCH_WINDOW_MS = 2 * DAY_MS;
/** A booking leads the deal until the day after the meeting, or this long when its date is unknown. */
const MEETING_UNKNOWN_DATE_WINDOW_MS = 7 * DAY_MS;

function meetingStillAhead(input: NextActionInput) {
  if (!input.meetingBookedAt) return false;
  const until = input.meetingAt
    ? input.meetingAt.getTime() + DAY_MS
    : input.meetingBookedAt.getTime() + MEETING_UNKNOWN_DATE_WINDOW_MS;
  return input.now.getTime() < until;
}

function daysSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function computeNextAction(input: NextActionInput): NextAction {
  const { now } = input;
  if (input.dealStatus === "VALIDATED") return { kind: "close_won" };
  if (input.readingNow) return { kind: "call_now" };
  if (input.dealStatus === "CHANGE_REQUESTED") return { kind: "reply" };
  // Answered once the seller logs a call or a message after it
  if (input.quoteRequestedAt && !(input.lastSellerContactAt && input.lastSellerContactAt > input.quoteRequestedAt)) {
    return { kind: "reply", quote: true };
  }
  if (input.draftToReview) return { kind: "review_draft" };
  if (input.snoozedUntil && input.snoozedUntil > now) return { kind: "snoozed", until: input.snoozedUntil };
  if (input.meetingBookedAt && meetingStillAhead(input)) {
    return { kind: "meeting_booked", at: input.meetingBookedAt, meetingAt: input.meetingAt ?? null };
  }
  if (input.lastSellerContactAt && now.getTime() - input.lastSellerContactAt.getTime() < IN_TOUCH_WINDOW_MS) {
    return { kind: "in_touch", at: input.lastSellerContactAt };
  }

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
    case "close_won":
      return "Validé par le prospect : confirmez la vente.";
    case "call_now":
      return "Lecture en cours : appelez maintenant.";
    case "reply":
      return action.quote ? "Devis demandé : envoyez-le." : "Demande d'ajustement en attente : répondez.";
    case "review_draft":
      return "Relance prête : relisez-la et validez.";
    case "meeting_booked":
      if (!action.meetingAt) return `Rendez-vous pris ${formatRelative(action.at, now)} : préparez l'échange.`;
      return action.meetingAt > now
        ? `Rendez-vous le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(action.meetingAt)} : préparez l'échange.`
        : "Rendez-vous passé : notez comment il s'est passé.";
    case "in_touch":
      return `Échange noté ${formatRelative(action.at, now)}, laissez-lui le temps.`;
    case "ai_advice":
      return action.text;
    case "snoozed":
      return `En pause jusqu'au ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(action.until)}.`;
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
