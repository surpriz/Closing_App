import type { FollowupChannel, FollowupTrigger, ProspectActionType, SellerAlertType } from "@/generated/prisma/enums";
import { formatDuration } from "@/lib/format";

import type { AppT } from "./i18n";

/**
 * "Ce qui s'est passé": reading sessions, prospect answers, alerts and sent
 * follow-ups, newest first. Inputs are plain facts so this stays pure.
 */

export type FeedKind =
  | "read"
  | "validated"
  | "change"
  | "quote"
  | "extension"
  | "relink"
  | "meeting"
  | "meeting_click"
  | "alert"
  | "followup";

export type FeedItem = {
  id: string;
  at: Date;
  kind: FeedKind;
  linkId: string;
  who: string;
  what: string;
  /** Deal and document, whichever `who` does not already say. */
  context: string | null;
  /** The prospect's own words, shown as a quote. */
  quote?: string | null;
};

export type FeedSource = {
  views: {
    id: string;
    lastSeenAt: Date;
    linkId: string;
    linkLabel: string;
    reader: string | null;
    documentName: string;
    totalDurationMs: number;
    pricingDurationMs: number;
  }[];
  actions: {
    id: string;
    createdAt: Date;
    linkId: string;
    who: string;
    linkLabel: string;
    type: ProspectActionType;
    documentName: string;
    message: string | null;
  }[];
  alerts: {
    id: string;
    createdAt: Date;
    linkId: string;
    linkLabel: string;
    documentName: string | null;
    type: SellerAlertType;
    payload: unknown;
  }[];
  followups: {
    id: string;
    sentAt: Date;
    linkId: string;
    who: string;
    linkLabel: string;
    channel: FollowupChannel;
    trigger: FollowupTrigger;
  }[];
};

/** Under this, the prospect opened the document but did not read it. */
const GLANCE_MS = 15_000;
/** Pricing time worth mentioning in a reading line. */
const PRICING_MENTION_MS = 20_000;

/** CHANNEL_LABELS in lower case, but WhatsApp keeps its capital. */
const CHANNEL: Record<FollowupChannel, string> = { EMAIL: "email", WHATSAPP: "WhatsApp" };

/** The quiet second line: deal, then document, each only when the line above does not say it. */
export function feedContext(who: string, linkLabel: string, documentName: string | null): string | null {
  // "Acme · Léa" after "Léa a lu…" keeps only "Acme"
  const parts = linkLabel.split(" · ").filter((part) => part !== who);
  if (documentName && documentName !== linkLabel && documentName !== who) parts.push(documentName);
  return parts.length ? parts.join(" · ") : null;
}

function describeRead(view: FeedSource["views"][number], t: AppT) {
  if (view.totalDurationMs < GLANCE_MS) return t("today.feed.openedDocument");
  const duration = formatDuration(view.totalDurationMs);
  return view.pricingDurationMs >= PRICING_MENTION_MS
    ? t("today.feed.readForPricing", { duration, pricing: formatDuration(view.pricingDurationMs) })
    : t("today.feed.readFor", { duration });
}

export const ACTION_KIND = {
  VALIDATE_SIGN: "validated",
  REQUEST_CHANGE: "change",
  REQUEST_QUOTE: "quote",
  REQUEST_EXTENSION: "extension",
  REQUEST_RELINK: "relink",
  MEETING_BOOKED: "meeting",
  MEETING_CLICK: "meeting_click",
} as const satisfies Record<ProspectActionType, FeedKind>;

function describeAction(type: ProspectActionType, t: AppT) {
  return t(`today.feed.action.${type}`);
}

function describeAlert(type: SellerAlertType, payload: unknown, t: AppT) {
  const { liveViewers, inactiveDays, reason, readerOrigin, forwardedTo, deadState } = (payload ?? {}) as {
    liveViewers?: number;
    inactiveDays?: number;
    reason?: string;
    readerOrigin?: string;
    forwardedTo?: string;
    deadState?: "archived" | "expired";
  };
  if (type === "CALL_MOMENT") {
    return reason
      ? t("today.feed.alert.callMomentReason", { reason: reason.toLowerCase() })
      : t("today.feed.alert.callMoment");
  }
  if (type === "PROSPECT_VALIDATED") return t("today.feed.alert.prospectValidated");
  if (type === "CHANGE_REQUESTED") return t("today.feed.alert.changeRequested");
  if (type === "QUOTE_REQUESTED") return t("today.feed.alert.quoteRequested");
  if (type === "PROSPECT_QUESTION") return t("today.feed.alert.prospectQuestion");
  if (type === "VOICE_COMMENT") return t("today.feed.alert.voiceComment");
  if (type === "MEETING_BOOKED") return t("today.feed.alert.meetingBooked");
  if (type === "PROSPECT_REPLIED") return t("today.feed.alert.prospectReplied");
  if (type === "EMAIL_BOUNCED") return t("today.feed.alert.emailBounced");
  if (type === "DOCUMENT_FORWARDED") {
    return forwardedTo
      ? t("today.feed.alert.documentForwardedTo", { to: forwardedTo })
      : t("today.feed.alert.documentForwarded");
  }
  if (type === "MULTI_VIEWER") {
    return liveViewers
      ? t("today.feed.alert.multiViewerCount", { count: liveViewers })
      : t("today.feed.alert.multiViewer");
  }
  if (type === "DRAFT_READY") return t("today.feed.alert.draftReady");
  if (type === "LINK_EXTENSION_REQUESTED") return t("today.feed.alert.extensionRequested");
  if (type === "LINK_EXPIRING") return t("today.feed.alert.linkExpiring");
  if (type === "RELINK_REQUESTED") return t("today.feed.alert.relinkRequested");
  if (type === "DEAD_LINK_OPENED") {
    return deadState === "expired"
      ? t("today.feed.alert.deadLinkOpenedExpired")
      : t("today.feed.alert.deadLinkOpenedArchived");
  }
  if (type === "COMMITTEE_LIVE") {
    return liveViewers != null
      ? t("today.feed.alert.committeeLive", { count: liveViewers })
      : t("today.feed.alert.committeeLiveSeveral");
  }
  if (type === "DECISION_MAKER_DETECTED") return t("today.feed.alert.decisionMaker");
  if (type === "NEW_READER") {
    return readerOrigin === "forwarded_internal"
      ? t("today.feed.alert.forwardedInternal")
      : t("today.feed.alert.newReader");
  }
  return inactiveDays ? t("today.feed.alert.reopenedDays", { days: inactiveDays }) : t("today.feed.alert.reopened");
}

function describeFollowup(followup: FeedSource["followups"][number], t: AppT) {
  const channel = CHANNEL[followup.channel];
  if (followup.trigger === "ANTI_GHOSTING") return t("today.feed.followupAntiGhosting", { channel });
  if (followup.trigger === "EXPIRY_REMINDER") return t("today.feed.followupExpiry", { channel });
  return t("today.feed.followup", { channel });
}

export function buildFeed(source: FeedSource, limit: number, t: AppT): FeedItem[] {
  const items: FeedItem[] = [
    ...source.views.map((view) => ({
      id: `view-${view.id}`,
      at: view.lastSeenAt,
      kind: "read" as const,
      linkId: view.linkId,
      who: view.reader ?? view.linkLabel,
      what: describeRead(view, t),
      context: feedContext(view.reader ?? view.linkLabel, view.linkLabel, view.documentName),
    })),
    ...source.actions.map((action) => ({
      id: `action-${action.id}`,
      at: action.createdAt,
      kind: ACTION_KIND[action.type],
      linkId: action.linkId,
      who: action.who,
      what: describeAction(action.type, t),
      context: feedContext(action.who, action.linkLabel, action.documentName),
      quote: action.message,
    })),
    ...source.alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      at: alert.createdAt,
      // Back on a dead link reads like the request it often comes before
      kind: alert.type === "DEAD_LINK_OPENED" ? ("relink" as const) : ("alert" as const),
      linkId: alert.linkId,
      who: alert.linkLabel,
      what: describeAlert(alert.type, alert.payload, t),
      context: feedContext(alert.linkLabel, alert.linkLabel, alert.documentName),
    })),
    ...source.followups.map((followup) => ({
      id: `followup-${followup.id}`,
      at: followup.sentAt,
      kind: "followup" as const,
      linkId: followup.linkId,
      who: followup.who,
      context: feedContext(followup.who, followup.linkLabel, null),
      what: describeFollowup(followup, t),
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
