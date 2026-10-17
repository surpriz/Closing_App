// Seller-facing UI languages. The prospect viewer has its own, wider list
// (SUPPORTED_LOCALES in lib/closing/constants).
export const UI_LOCALES = ["en", "fr"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = "en";

/** Remembers the choice before sign-in, and on devices where the session is not there yet. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Tag handed to Intl formatters. */
export const INTL_LOCALE: Record<UiLocale, string> = { en: "en-US", fr: "fr-FR" };

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value);
}

/** Best match of an Accept-Language header among `supported`, by quality. */
export function matchLocale<T extends string>(
  acceptLanguage: string | null | undefined,
  supported: readonly T[],
  fallback: T,
): T {
  if (!acceptLanguage) return fallback;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q.split("=")[1]) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { base } of candidates) {
    if ((supported as readonly string[]).includes(base)) return base as T;
  }
  return fallback;
}

export function pickUiLocale(acceptLanguage: string | null | undefined): UiLocale {
  return matchLocale(acceptLanguage, UI_LOCALES, DEFAULT_UI_LOCALE);
}

/** Saved choice first, then the cookie, then the browser. */
export function resolveUiLocale(input: {
  saved?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): UiLocale {
  if (isUiLocale(input.saved)) return input.saved;
  if (isUiLocale(input.cookie)) return input.cookie;
  return pickUiLocale(input.acceptLanguage);
}
