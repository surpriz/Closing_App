import type { Metadata } from "next";

import { getPathname } from "./navigation";
import { routing, type AppPathname, type Locale } from "./routing";

export const SITE_URL = "https://www.clozer.club";

export function localizedPath(locale: Locale, href: AppPathname) {
  return getPathname({ locale, href });
}

/** Canonical + hreflang for one page, in every locale. Relative to metadataBase. */
export function alternatesFor(locale: Locale, href: AppPathname): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const other of routing.locales) languages[other] = localizedPath(other, href);
  languages["x-default"] = localizedPath(routing.defaultLocale, href);
  return { canonical: localizedPath(locale, href), languages };
}

export const OG_LOCALE: Record<Locale, string> = { en: "en_US", fr: "fr_FR" };
