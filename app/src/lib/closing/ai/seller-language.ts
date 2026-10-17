import type { UiLocale } from "@/i18n/locale";

/**
 * Prompts stay in English; only the language of what the model writes for
 * the seller follows their locale. Never for prospect-facing text.
 */
export function sellerLanguageName(locale: UiLocale) {
  return locale === "fr" ? "French" : "English";
}

/** "in French, … as "vous"" / "in English, … as "you"" */
export function sellerVoice(locale: UiLocale, who = "the salesperson") {
  return locale === "fr"
    ? `in French, plain and direct, addressing ${who} as "vous"`
    : `in English, plain and direct, addressing ${who} as "you"`;
}
