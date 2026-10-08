import type { SellerAlertType } from "@/generated/prisma/enums";

/**
 * Text of a Chrome notification, short enough for the system popup
 * (title ~40 chars, body ~120). Pure.
 */
export function extensionNotice(
  type: SellerAlertType,
  who: string,
  documentName: string,
  payload: { reason?: string; message?: string | null; liveViewers?: number; inactiveDays?: number },
) {
  switch (type) {
    case "PROSPECT_VALIDATED":
      return { title: `${who} a validé`, body: `« ${documentName} » est validé. Revenez vers ce prospect rapidement.` };
    case "CHANGE_REQUESTED":
      return {
        title: `${who} demande un ajustement`,
        body: payload.message ? `« ${truncate(payload.message, 110)} »` : `Sur « ${documentName} ».`,
      };
    case "DRAFT_READY":
      return { title: "Relance à valider", body: `Une relance pour ${who} attend votre accord.` };
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
