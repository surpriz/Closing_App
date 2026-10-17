import type { useTranslations } from "next-intl";

import type { UiLocale } from "@/i18n/locale";

/**
 * Root translator, as `useTranslations()`, `await getTranslations()` or
 * `getTranslator(locale)` give it. The dashboard text builders take it so they
 * stay pure and work on both sides.
 */
export type AppT = ReturnType<typeof useTranslations<never>>;

export type DashboardI18n = { t: AppT; locale: UiLocale };

/** A key built at runtime from data (AI output, enum): translated when it exists, else the raw value. */
export function maybeT(t: AppT, key: string, fallback: string): string {
  return t.has(key as never) ? t(key as never) : fallback;
}
