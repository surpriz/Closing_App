import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
  // Folder names under app/[locale] are the English ones; French gets its own slugs.
  pathnames: {
    "/": "/",
    "/terms": { en: "/terms", fr: "/cgu" },
    "/privacy": { en: "/privacy", fr: "/confidentialite" },
    "/legal": { en: "/legal", fr: "/mentions-legales" },
    "/subprocessors": { en: "/subprocessors", fr: "/sous-traitants" },
    "/support": "/support",
    "/use-cases": { en: "/use-cases", fr: "/cas-d-usage" },
    "/pricing": { en: "/pricing", fr: "/tarifs" },
  },
  // The pages carry their own hreflang tags (see i18n/seo.ts), no need for the Link header too.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
