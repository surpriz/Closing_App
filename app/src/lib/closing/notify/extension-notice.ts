import type { SellerAlertType } from "@/generated/prisma/enums";

import { formatDeadline } from "../expiry";

/**
 * Text of a Chrome notification, short enough for the system popup
 * (title ~40 chars, body ~120). Pure.
 */
export function extensionNotice(
  type: SellerAlertType,
  who: string,
  documentName: string,
  payload: {
    reason?: string;
    message?: string | null;
    question?: string;
    transcript?: string | null;
    pageNumber?: number;
    liveViewers?: number;
    inactiveDays?: number;
    expiresAt?: string;
  },
  timezone = "Europe/Paris",
) {
  switch (type) {
    case "LINK_EXTENSION_REQUESTED":
      return { title: `${who} demande plus de temps`, body: `« ${documentName} » a expiré. Prolongez-le en un clic.` };
    case "LINK_EXPIRING": {
      const when = payload.expiresAt ? `le ${formatDeadline(new Date(payload.expiresAt), "fr-FR", timezone)}` : "demain";
      return { title: `Expire bientôt : ${who}`, body: `« ${documentName} » expire ${when}. Prolongez ou relancez.` };
    }
    case "PROSPECT_QUESTION":
      return {
        title: `${who} a une question`,
        body: payload.question ? `« ${truncate(payload.question, 110)} »` : `Sur « ${documentName} ».`,
      };
    case "VOICE_COMMENT":
      return {
        title: `${who} a laissé un vocal`,
        body: payload.transcript
          ? `« ${truncate(payload.transcript, 110)} »`
          : `Page ${payload.pageNumber ?? "?"} de « ${documentName} ».`,
      };
    case "PROSPECT_VALIDATED":
      return { title: `${who} a validé`, body: `« ${documentName} » est validé. Revenez vers ce prospect rapidement.` };
    case "CHANGE_REQUESTED":
      return {
        title: `${who} demande un ajustement`,
        body: payload.message ? `« ${truncate(payload.message, 110)} »` : `Sur « ${documentName} ».`,
      };
    case "DRAFT_READY":
      return { title: "Relance à valider", body: `Une relance pour ${who} attend votre accord.` };
    case "COMMITTEE_LIVE":
      return { title: `Comité en lecture chez ${who}`, body: `${truncate(payload.reason ?? "Plusieurs personnes lisent", 90)}. C'est le moment d'appeler.` };
    case "DECISION_MAKER_DETECTED":
      return { title: `Décideur en lecture : ${who}`, body: `${truncate(payload.reason ?? "Un décideur lit votre proposition", 110)}.` };
    case "NEW_READER":
      return { title: `Nouveau lecteur chez ${who}`, body: `${truncate(payload.reason ?? "Quelqu'un de nouveau lit votre proposition", 110)}.` };
    default: {
      const reason =
        payload.reason ??
        (type === "MULTI_VIEWER"
          ? `${payload.liveViewers ?? "Plusieurs"} personnes lisent en même temps`
          : `Revient après ${payload.inactiveDays ?? "quelques"} jours`);
      return { title: `${who} lit votre proposition`, body: `${reason}. C'est le moment d'appeler.` };
    }
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
