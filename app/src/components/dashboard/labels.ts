import type { useTranslations } from "next-intl";

import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import type { HealthSignal } from "@/lib/closing/dashboard/team";

// Enum labels live in messages/{en,fr}/labels.json, keyed by the enum value:
// t(`dealStatus.${status}`) with t = useTranslations("labels") / getTranslations("labels").
// Keys coming from the AI (scoreReason, stage, friction…) may be unknown: check t.has() first.

export type LabelsT = ReturnType<typeof useTranslations<"labels">>;

/** Workspace role, or the raw value when it is not one of ours. */
export function roleLabel(t: LabelsT, role: string) {
  return role === "owner" || role === "admin" || role === "member" ? t(`role.${role}`) : role;
}

/** Why a deal sits in its column on the team page. */
export function describeHealthSignal(t: LabelsT, locale: UiLocale, signal: HealthSignal) {
  switch (signal.code) {
    case "quiet":
    case "unopened":
    case "never_opened":
    case "silent":
      return t(`healthSignal.${signal.code}`, { days: signal.days });
    case "deadline_passed":
      return t("healthSignal.deadline_passed", {
        date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short" }).format(signal.date),
      });
    default:
      return t(`healthSignal.${signal.code}`);
  }
}
