import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { DAY_MS } from "../constants";
import { nextBusinessSlot, type BusinessHours } from "../scheduling/business-hours";
import type { FOLLOWUP_GOALS, TIMINGS } from "./schema";

/**
 * Whether the follow-up an analysis recommends may go out, and when. Pure.
 * The model chooses the angle and a timing bucket; these rules own the
 * calendar and the limits, so a confident model can't spam a prospect.
 */

const HOUR_MS = 60 * 60 * 1000;
/** After a logged call or reply, written follow-ups wait this long. */
const SELLER_CONTACT_QUIET_MS = 2 * DAY_MS;
/** Deadline-driven follow-ups land this many days before the decision date. */
const DAYS_BEFORE_DEADLINE = 3;

export type FollowupPolicyInput = {
  now: Date;
  /** The seller's: they read the reasons when a follow-up is refused. */
  locale: UiLocale;
  timing: (typeof TIMINGS)[number];
  channel: "EMAIL" | "WHATSAPP" | "PHONE" | null;
  deal: {
    dealStatus: string;
    followupsEnabled: boolean;
    archived: boolean;
    snoozedUntil: Date | null;
    /** The prospect booked a meeting from the viewer: written follow-ups stop for good. */
    meetingBooked?: boolean;
    /** The prospect asked for a quote under a video pitch: the seller answers, not a follow-up. */
    quoteRequested?: boolean;
    /** The prospect answered by email: the seller carries the conversation. */
    replied?: boolean;
    decisionDeadline: Date | null;
    /** After it the link no longer opens: nothing may land later. */
    expiresAt?: Date | null;
    /** Channels allowed on this link (link override or workspace default). */
    channels: ("EMAIL" | "WHATSAPP")[];
    lastReadingAt: Date | null;
  };
  prospect: {
    unsubscribed: boolean;
    /** An email to this address bounced for good. */
    bounced?: boolean;
    canWhatsApp: boolean;
    timezone: string;
  } | null;
  history: {
    /** Follow-ups already sent to this prospect, any channel. */
    sentAt: Date[];
    lastSellerContactAt: Date | null;
    /** A follow-up the seller approved is already waiting to go out. */
    approvedPending: boolean;
    /** The deadline reminder already covers the next message. */
    expiryReminderOpen?: boolean;
  };
  settings: {
    maxFollowupsPer30Days: number;
    minDaysBetweenFollowups: number;
    minDelayAfterReadingHours: number;
    businessHours: BusinessHours;
  };
};

export type FollowupDecision =
  | { allowed: true; scheduledFor: Date; channel: "EMAIL" | "WHATSAPP" }
  | { allowed: false; reasons: string[] };

export function decideFollowup(input: FollowupPolicyInput): FollowupDecision {
  const { now, deal, prospect, history, settings } = input;
  const t = getNamespaceTranslator(input.locale, "server.followups.policy");
  const reasons: string[] = [];

  if (deal.archived || !["OPEN", "CHANGE_REQUESTED"].includes(deal.dealStatus)) reasons.push(t("notActive"));
  if (!deal.followupsEnabled) reasons.push(t("followupsOff"));
  if (deal.snoozedUntil && deal.snoozedUntil > now) reasons.push(t("snoozed"));
  if (deal.meetingBooked) reasons.push(t("meetingBooked"));
  if (deal.quoteRequested) reasons.push(t("quoteRequested"));
  if (deal.replied) reasons.push(t("replied"));
  if (!prospect) reasons.push(t("noContact"));
  else if (prospect.unsubscribed) reasons.push(t("unsubscribed"));
  else if (prospect.bounced && !prospect.canWhatsApp) reasons.push(t("bounced"));
  if (history.approvedPending) reasons.push(t("approvedPending"));
  if (deal.expiresAt && deal.expiresAt <= now) reasons.push(t("expired"));
  if (history.expiryReminderOpen) reasons.push(t("expiryReminderOpen"));

  const sentLast30 = history.sentAt.filter((at) => now.getTime() - at.getTime() < 30 * DAY_MS).length;
  if (sentLast30 >= settings.maxFollowupsPer30Days) {
    reasons.push(t("maxReached", { count: sentLast30 }));
  }
  if (history.lastSellerContactAt && now.getTime() - history.lastSellerContactAt.getTime() < SELLER_CONTACT_QUIET_MS) {
    reasons.push(t("recentContact"));
  }

  const channel = pickChannel(input);
  if (!channel) reasons.push(t("noChannel"));
  if (reasons.length > 0 || !prospect || !channel) return { allowed: false, reasons };

  // Never right after a read (it would give the tracking away), never too close to the last one
  const lastSent = history.sentAt.reduce<Date | null>((latest, at) => (!latest || at > latest ? at : latest), null);
  const earliest = new Date(
    Math.max(
      now.getTime(),
      deal.lastReadingAt ? deal.lastReadingAt.getTime() + settings.minDelayAfterReadingHours * HOUR_MS : 0,
      lastSent ? lastSent.getTime() + settings.minDaysBetweenFollowups * DAY_MS : 0,
    ),
  );

  const slot = (from: Date, mode: "asap" | "next-morning") =>
    nextBusinessSlot(from, prospect.timezone, settings.businessHours, mode);

  let target: Date;
  switch (input.timing) {
    case "now":
      target = slot(earliest, "asap");
      break;
    case "next_business_morning":
      target = slot(now, "next-morning");
      break;
    case "in_2_business_days":
      target = slot(slot(now, "next-morning"), "next-morning");
      break;
    case "in_1_week":
      target = slot(new Date(now.getTime() + 7 * DAY_MS), "asap");
      break;
    case "before_deadline": {
      const deadline = deal.decisionDeadline ?? deal.expiresAt ?? null;
      const before = deadline ? new Date(deadline.getTime() - DAYS_BEFORE_DEADLINE * DAY_MS) : now;
      target = slot(before > now ? before : now, "asap");
      break;
    }
  }
  const scheduledFor = target < earliest ? slot(earliest, "asap") : target;
  if (deal.expiresAt && scheduledFor >= deal.expiresAt) {
    return { allowed: false, reasons: [t("afterExpiry")] };
  }

  return { allowed: true, scheduledFor, channel };
}

function pickChannel(input: FollowupPolicyInput): "EMAIL" | "WHATSAPP" | null {
  const allowed = input.deal.channels;
  if (input.channel === "WHATSAPP" && allowed.includes("WHATSAPP") && input.prospect?.canWhatsApp) return "WHATSAPP";
  if (allowed.includes("EMAIL") && !input.prospect?.bounced) return "EMAIL";
  if (allowed.includes("WHATSAPP") && input.prospect?.canWhatsApp) return "WHATSAPP";
  return null;
}

/** Goals safe enough to send without the seller reading first. */
const AUTOPILOT_GOALS: (typeof FOLLOWUP_GOALS)[number][] = [
  "gentle_reminder",
  "propose_call",
  "share_case_study",
  "clarify_pricing",
];
/** Text written by the prospect is answered by a human. */
const PROSPECT_TEXT_WINDOW_MS = 14 * DAY_MS;

export function autopilotEligible(input: {
  now: Date;
  autonomy: "COPILOT" | "AUTOPILOT";
  minConfidence: number;
  confidence: number;
  goal: (typeof FOLLOWUP_GOALS)[number] | null;
  lastProspectTextAt: Date | null;
  guardPassedFirstTry: boolean;
  offerDescribed: boolean;
}) {
  return (
    input.autonomy === "AUTOPILOT" &&
    input.confidence >= input.minConfidence &&
    input.goal !== null &&
    AUTOPILOT_GOALS.includes(input.goal) &&
    (!input.lastProspectTextAt || input.now.getTime() - input.lastProspectTextAt.getTime() > PROSPECT_TEXT_WINDOW_MS) &&
    input.guardPassedFirstTry &&
    input.offerDescribed
  );
}
