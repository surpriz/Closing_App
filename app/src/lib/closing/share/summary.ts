import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { DAY_MS } from "../constants";

/**
 * What the prospect will meet on a link, in a few words: the share screen's
 * chips and the line the extensions show after inserting a link. Pure, server only.
 */
export function settingsSummary(
  link: {
    shared: boolean;
    requireEmail: boolean;
    expiresAt: Date | null;
    ctaEnabled: boolean;
    chatEnabled: boolean;
    followupsEnabled: boolean;
  },
  now: Date,
  locale: UiLocale,
) {
  const t = getNamespaceTranslator(locale, "server.linkSummary");
  const days = link.expiresAt ? Math.max(0, Math.ceil((link.expiresAt.getTime() - now.getTime()) / DAY_MS)) : null;
  return [
    link.shared ? t("perReader") : link.requireEmail ? t("emailRequired") : t("open"),
    days === null ? t("noExpiry") : t("expiresIn", { days }),
    link.ctaEnabled ? t("onlineApproval") : null,
    link.chatEnabled ? t("aiAssistant") : null,
    link.followupsEnabled ? (link.shared ? t("followupsReview") : t("followupsAuto")) : t("noFollowups"),
  ].filter((item): item is string => !!item);
}
