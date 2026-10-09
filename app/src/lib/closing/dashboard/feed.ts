import type { FollowupChannel, FollowupTrigger, ProspectActionType, SellerAlertType } from "@/generated/prisma/enums";
import { formatDuration } from "@/lib/format";

/**
 * "Ce qui s'est passé": reading sessions, prospect answers, alerts and sent
 * follow-ups, newest first. Inputs are plain facts so this stays pure.
 */

export type FeedKind = "read" | "validated" | "change" | "alert" | "followup";

export type FeedItem = {
  id: string;
  at: Date;
  kind: FeedKind;
  linkId: string;
  who: string;
  what: string;
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
    type: ProspectActionType;
    documentName: string;
    message: string | null;
  }[];
  alerts: {
    id: string;
    createdAt: Date;
    linkId: string;
    linkLabel: string;
    type: SellerAlertType;
    payload: unknown;
  }[];
  followups: {
    id: string;
    sentAt: Date;
    linkId: string;
    who: string;
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

export function readerLabel(reader: string | null, linkLabel: string) {
  return reader && reader !== linkLabel ? `${reader} (${linkLabel})` : linkLabel;
}

function describeRead(view: FeedSource["views"][number]) {
  if (view.totalDurationMs < GLANCE_MS) return `a ouvert ${view.documentName}`;
  const pricing =
    view.pricingDurationMs >= PRICING_MENTION_MS ? `, dont ${formatDuration(view.pricingDurationMs)} sur les tarifs` : "";
  return `a lu ${view.documentName} pendant ${formatDuration(view.totalDurationMs)}${pricing}`;
}

function describeAlert(type: SellerAlertType, payload: unknown) {
  const { liveViewers, inactiveDays, reason, readerOrigin } = (payload ?? {}) as {
    liveViewers?: number;
    inactiveDays?: number;
    reason?: string;
    readerOrigin?: string;
  };
  if (type === "CALL_MOMENT") return reason ? `est lu en ce moment (${reason.toLowerCase()})` : "est lu en ce moment";
  if (type === "PROSPECT_VALIDATED") return "a été validé";
  if (type === "CHANGE_REQUESTED") return "fait l'objet d'une demande d'ajustement";
  if (type === "PROSPECT_QUESTION") return "a une question en attente de votre réponse";
  if (type === "MULTI_VIEWER") {
    return liveViewers ? `est lu par ${liveViewers} personnes en même temps` : "est lu à plusieurs";
  }
  if (type === "DRAFT_READY") return "a une relance prête à valider";
  if (type === "COMMITTEE_LIVE") return `est lu par ${liveViewers ?? "plusieurs"} personnes en même temps (comité)`;
  if (type === "DECISION_MAKER_DETECTED") return "est lu par un décideur";
  if (type === "NEW_READER") return readerOrigin === "forwarded_internal" ? "a été repartagé en interne" : "a un nouveau lecteur";
  return inactiveDays ? `a été rouvert après ${inactiveDays} jours de silence` : "a été rouvert après un silence";
}

export function buildFeed(source: FeedSource, limit: number): FeedItem[] {
  const items: FeedItem[] = [
    ...source.views.map((view) => ({
      id: `view-${view.id}`,
      at: view.lastSeenAt,
      kind: "read" as const,
      linkId: view.linkId,
      who: readerLabel(view.reader, view.linkLabel),
      what: describeRead(view),
    })),
    ...source.actions.map((action) => ({
      id: `action-${action.id}`,
      at: action.createdAt,
      kind: action.type === "VALIDATE_SIGN" ? ("validated" as const) : ("change" as const),
      linkId: action.linkId,
      who: action.who,
      what:
        action.type === "VALIDATE_SIGN"
          ? `a validé ${action.documentName}`
          : `demande un ajustement sur ${action.documentName}`,
      quote: action.message,
    })),
    ...source.alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      at: alert.createdAt,
      kind: "alert" as const,
      linkId: alert.linkId,
      who: alert.linkLabel,
      what: describeAlert(alert.type, alert.payload),
    })),
    ...source.followups.map((followup) => ({
      id: `followup-${followup.id}`,
      at: followup.sentAt,
      kind: "followup" as const,
      linkId: followup.linkId,
      who: followup.who,
      what: `a reçu une relance ${CHANNEL[followup.channel]}${
        followup.trigger === "ANTI_GHOSTING" ? " (lien pas encore ouvert)" : ""
      }`,
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
