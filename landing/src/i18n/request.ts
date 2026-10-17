import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { MESSAGES } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  // Dates on the pages are calendar days, read in the company's time zone.
  return { locale, messages: MESSAGES[locale], timeZone: "Europe/Paris" };
});
