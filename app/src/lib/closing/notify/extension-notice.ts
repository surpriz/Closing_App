import type { SellerAlertType } from "@/generated/prisma/enums";
import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

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
    meetingAt?: string | null;
  },
  locale: UiLocale,
  timezone = "Europe/Paris",
) {
  const t = getNamespaceTranslator(locale, "alerts");
  const doc = t("common.doc", { name: documentName });
  const quote = (text: string, max: number) => t("common.quote", { text: truncate(text, max) });
  const date = (iso: string) => formatDeadline(new Date(iso), INTL_LOCALE[locale], timezone);
  switch (type) {
    case "LINK_EXTENSION_REQUESTED":
      return { title: t("notice.linkExtensionRequested.title", { who }), body: t("notice.linkExtensionRequested.body", { doc }) };
    case "LINK_EXPIRING":
      return {
        title: t("notice.linkExpiring.title", { who }),
        body: payload.expiresAt
          ? t("notice.linkExpiring.bodyDate", { doc, date: date(payload.expiresAt) })
          : t("notice.linkExpiring.bodyTomorrow", { doc }),
      };
    case "PROSPECT_QUESTION":
      return {
        title: t("notice.prospectQuestion.title", { who }),
        body: payload.question ? quote(payload.question, 110) : t("notice.on", { doc }),
      };
    case "VOICE_COMMENT":
      return {
        title: t("notice.voiceComment.title", { who }),
        body: payload.transcript
          ? quote(payload.transcript, 110)
          : t("notice.voiceComment.bodyPage", { page: payload.pageNumber ?? "?", doc }),
      };
    case "PROSPECT_VALIDATED":
      return { title: t("notice.prospectValidated.title", { who }), body: t("notice.prospectValidated.body", { doc }) };
    case "MEETING_BOOKED":
      return {
        title: t("notice.meetingBooked.title", { who }),
        body: payload.meetingAt
          ? t("notice.meetingBooked.bodyDate", { date: date(payload.meetingAt), doc })
          : t("notice.meetingBooked.body", { doc }),
      };
    case "CHANGE_REQUESTED":
      return {
        title: t("notice.changeRequested.title", { who }),
        body: payload.message ? quote(payload.message, 110) : t("notice.on", { doc }),
      };
    case "QUOTE_REQUESTED":
      return {
        title: t("notice.quoteRequested.title", { who }),
        body: payload.message ? quote(payload.message, 110) : t("notice.quoteRequested.bodyAfter", { doc }),
      };
    case "DRAFT_READY":
      return { title: t("notice.draftReady.title"), body: t("notice.draftReady.body", { who }) };
    case "COMMITTEE_LIVE":
      return {
        title: t("notice.committeeLive.title", { who }),
        body: t("notice.callNow", { reason: truncate(payload.reason ?? t("notice.committeeLive.reasonFallback"), 90) }),
      };
    case "DECISION_MAKER_DETECTED":
      return {
        title: t("notice.decisionMaker.title", { who }),
        body: t("notice.reason", { reason: truncate(payload.reason ?? t("notice.decisionMaker.reasonFallback"), 110) }),
      };
    case "NEW_READER":
      return {
        title: t("notice.newReader.title", { who }),
        body: t("notice.reason", { reason: truncate(payload.reason ?? t("notice.newReader.reasonFallback"), 110) }),
      };
    default: {
      const reason =
        payload.reason ??
        (type === "MULTI_VIEWER"
          ? payload.liveViewers
            ? t("notice.hot.reasonMulti", { count: payload.liveViewers })
            : t("notice.hot.reasonMultiMany")
          : payload.inactiveDays
            ? t("notice.hot.reasonBack", { days: payload.inactiveDays })
            : t("notice.hot.reasonBackSome"));
      return { title: t("notice.hot.title", { who }), body: t("notice.callNow", { reason }) };
    }
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
