import { INTL_LOCALE } from "@/i18n/locale";
import { formatRelative } from "@/lib/format";

import { DAY_MS } from "../constants";

import { maybeT, type DashboardI18n } from "./i18n";

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
  /** The prospect answered by email (reply relay or extension). */
  repliedAt?: Date | null;
  /** Someone reached the email gate without going through: clicked, did not read. */
  gateSeenAt?: Date | null;
  /** The prospect came back to the link after it was archived or expired (revival.ts). */
  revival?: { at: Date; asked: boolean; state: "archived" | "expired" } | null;
  /** Nobody known on the link: whoever reads, there is no one to call yet. */
  anonymous?: boolean;
};

export type NextAction =
  /** The prospect signed: one click to record the sale. */
  | { kind: "close_won" }
  | { kind: "call_now" }
  /** Someone nobody knows reads now (live) or read a lot: find out who before calling anyone. */
  | { kind: "identify"; live: boolean }
  /** A change request, a quote asked for, or an email answer, not answered yet. */
  | { kind: "reply"; quote?: boolean; email?: boolean }
  /** The link no longer opens and the prospect came back to it: reopen it while the interest is there. */
  | { kind: "reactivate"; at: Date; asked: boolean; state: "archived" | "expired" }
  | { kind: "review_draft" }
  | { kind: "call"; pricing: boolean }
  | { kind: "followup_planned"; at: Date; opened: boolean }
  | { kind: "nudge"; days: number; opened: boolean; clicked?: boolean }
  | { kind: "wait"; days: number; opened: boolean; tier: Tier | null; clicked?: boolean }
  | { kind: "in_touch"; at: Date }
  /** A meeting is in the seller's calendar: follow-ups stopped, nothing to chase. */
  | { kind: "meeting_booked"; at: Date; meetingAt: Date | null }
  | { kind: "snoozed"; until: Date }
  /** What the deal analysis recommends, when it is current. */
  | { kind: "ai_advice"; adviceType: string; timing: string; urgent: boolean };

/** Most urgent first. */
const URGENCY: NextAction["kind"][] = [
  "close_won",
  "call_now",
  "reactivate",
  "reply",
  "review_draft",
  "call",
  "identify",
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
  "identify",
  "reactivate",
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
): NextAction {
  if (!advice || FACTUAL.includes(action.kind)) return action;
  return {
    kind: "ai_advice",
    adviceType: advice.type,
    timing: advice.timing,
    urgent: advice.priority >= 4 && advice.type !== "wait",
  };
}

function describeAiAdvice(action: Extract<NextAction, { kind: "ai_advice" }>, { t }: DashboardI18n) {
  if (action.adviceType === "wait") return t("today.nextAction.aiWait");
  if (action.adviceType === "close_lost") return t("today.nextAction.aiCloseLost");
  const verb = maybeT(t, `labels.insightAction.${action.adviceType}`, action.adviceType);
  const timingKey = `labels.timing.${action.timing}`;
  return t.has(timingKey as never)
    ? t("today.nextAction.aiAdvice", { verb, timing: t(timingKey as never) })
    : t("today.nextAction.aiAdviceNoTiming", { verb });
}

/** A prospect who read and went quiet this long needs a word from the seller. */
const QUIET_DAYS_BEFORE_NUDGE = 3;
/** Pricing read this recently is still worth a call. */
const PRICING_CALL_WINDOW_MS = 3 * DAY_MS;
/** After a call or a reply logged by the seller, the ball is in the prospect's court for a while. */
const IN_TOUCH_WINDOW_MS = 2 * DAY_MS;
/** An email answer stays the thing to do this long, unless the seller logs a contact after it. */
const REPLY_WINDOW_MS = 3 * DAY_MS;
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
  if (input.readingNow) return input.anonymous ? { kind: "identify", live: true } : { kind: "call_now" };
  // Nothing else can happen on a link that does not open: reopening it comes first
  if (input.revival) return { kind: "reactivate", ...input.revival };
  if (input.dealStatus === "CHANGE_REQUESTED") return { kind: "reply" };
  // Answered once the seller logs a call or a message after it
  if (input.quoteRequestedAt && !(input.lastSellerContactAt && input.lastSellerContactAt > input.quoteRequestedAt)) {
    return { kind: "reply", quote: true };
  }
  if (
    input.repliedAt &&
    now.getTime() - input.repliedAt.getTime() < REPLY_WINDOW_MS &&
    !(input.lastSellerContactAt && input.lastSellerContactAt > input.repliedAt)
  ) {
    return { kind: "reply", email: true };
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
    const clicked = input.gateSeenAt ? { clicked: true } : {};
    if (!input.followupsEnabled && days >= 2) return { kind: "nudge", days, opened: false, ...clicked };
    return { kind: "wait", days, opened: false, tier: null, ...clicked };
  }

  const recentPricing =
    input.pricingFocus &&
    input.lastActivityAt !== null &&
    now.getTime() - input.lastActivityAt.getTime() <= PRICING_CALL_WINDOW_MS;
  if (input.tier === "HOT" || recentPricing) {
    return input.anonymous ? { kind: "identify", live: false } : { kind: "call", pricing: recentPricing };
  }

  if (input.nextFollowup) return { kind: "followup_planned", at: input.nextFollowup.scheduledFor, opened: true };

  const quietDays = input.lastActivityAt ? daysSince(input.lastActivityAt, now) : 0;
  if (quietDays >= QUIET_DAYS_BEFORE_NUDGE) return { kind: "nudge", days: quietDays, opened: true };
  return { kind: "wait", days: quietDays, opened: true, tier: input.tier };
}

export function describeNextAction(action: NextAction, now: Date, i18n: DashboardI18n): string {
  const { t, locale } = i18n;
  const dayMonth = (date: Date) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long" }).format(date);
  switch (action.kind) {
    case "close_won":
      return t("today.nextAction.closeWon");
    case "call_now":
      return t("today.nextAction.callNow");
    case "identify":
      return action.live ? t("today.nextAction.identifyLive") : t("today.nextAction.identify");
    case "reactivate":
      return action.asked
        ? t("today.nextAction.reactivateAsked", { when: formatRelative(action.at, locale, now) })
        : t("today.nextAction.reactivateReturned", { when: formatRelative(action.at, locale, now) });
    case "reply":
      if (action.email) return t("today.nextAction.replyEmail");
      return action.quote ? t("today.nextAction.replyQuote") : t("today.nextAction.reply");
    case "review_draft":
      return t("today.nextAction.reviewDraft");
    case "meeting_booked":
      if (!action.meetingAt) {
        return t("today.nextAction.meetingBooked", { when: formatRelative(action.at, locale, now) });
      }
      return action.meetingAt > now
        ? t("today.nextAction.meetingAhead", { date: dayMonth(action.meetingAt) })
        : t("today.nextAction.meetingPast");
    case "in_touch":
      return t("today.nextAction.inTouch", { when: formatRelative(action.at, locale, now) });
    case "ai_advice":
      return describeAiAdvice(action, i18n);
    case "snoozed":
      return t("today.nextAction.snoozed", { date: dayMonth(action.until) });
    case "call":
      return action.pricing ? t("today.nextAction.callPricing") : t("today.nextAction.call");
    case "followup_planned": {
      const when = formatRelative(action.at, locale, now);
      return action.opened
        ? t("today.nextAction.followupPlanned", { when })
        : t("today.nextAction.followupPlannedUnopened", { when });
    }
    case "nudge":
      if (action.clicked) return t("today.nextAction.nudgeClicked", { days: action.days });
      return action.opened
        ? t("today.nextAction.nudgeOpened", { days: action.days })
        : t("today.nextAction.nudgeUnopened", { days: action.days });
    case "wait":
      if (!action.opened) {
        if (action.clicked) return t("today.nextAction.clickedNotRead");
        return action.days === 0 ? t("today.nextAction.sentToday") : t("today.nextAction.notOpenedYet");
      }
      return action.tier === "WARM" ? t("today.nextAction.waitWarm") : t("today.nextAction.wait");
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
