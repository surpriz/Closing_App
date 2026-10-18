import type { Locale } from "@/i18n/routing";

export const APP_LOGIN_URL = "https://app.clozer.club/login";
/** Billing section of the app settings: plan, card, invoices. */
export const APP_BILLING_URL = new URL("/settings#facturation", APP_LOGIN_URL).href;
export const CONTACT_EMAIL = "contact@clozer.club";
export const EXTENSION_STORE_URL = "https://chromewebstore.google.com/detail/clozer/fnefeeodeepechnhbijpfmjjcolopmmj";

/** Entry to the app. `lang` tells it which language to create the account in. */
export function appUrl(locale: Locale, params: Record<string, string> = {}) {
  return `${APP_LOGIN_URL}?${new URLSearchParams({ ...params, lang: locale })}`;
}
