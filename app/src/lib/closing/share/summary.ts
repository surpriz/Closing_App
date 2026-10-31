import type { Autonomy } from "@/generated/prisma/enums";
import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { DAY_MS } from "../constants";

/**
 * What the prospect will meet on a link, in a few words: the share screen's
 * chips and the line the extensions show after inserting a link. Pure, server only.
 * The follow-up chip tells the truth of the workspace: who sends and whether the seller
 * approves first, or the campaign that drives the link instead of its own switch.
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
  opts: { autonomy?: Autonomy; campaign?: string | null } = {},
) {
  const t = getNamespaceTranslator(locale, "server.linkSummary");
  const days = link.expiresAt ? Math.max(0, Math.ceil((link.expiresAt.getTime() - now.getTime()) / DAY_MS)) : null;
  const followups = opts.campaign
    ? t("followupsCampaign", { name: opts.campaign })
    : !link.followupsEnabled
      ? t("noFollowups")
      : opts.autonomy === "AUTOPILOT" && !link.shared
        ? t("followupsAuto")
        : t("followupsReview");
  return [
    link.shared ? t("perReader") : link.requireEmail ? t("emailRequired") : t("open"),
    days === null ? t("noExpiry") : t("expiresIn", { days }),
    link.ctaEnabled ? t("onlineApproval") : null,
    link.chatEnabled ? t("aiAssistant") : null,
    followups,
  ].filter((item): item is string => !!item);
}
