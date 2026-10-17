import type { MetadataRoute } from "next";

import { UPDATED_AT } from "@/components/page-dates";
import { routing, type AppPathname } from "@/i18n/routing";
import { SITE_URL, alternatesFor } from "@/i18n/seo";

const PAGES: { path: AppPathname; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/subprocessors", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
  { path: "/support", changeFrequency: "monthly", priority: 0.4 },
];

// Every page in every locale, each listing its translations (hreflang in the sitemap).
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => {
      const alternates = alternatesFor(locale, path)!;
      const languages = Object.fromEntries(
        Object.entries(alternates.languages ?? {}).map(([lang, href]) => [lang, `${SITE_URL}${href}`]),
      );
      return {
        url: `${SITE_URL}${alternates.canonical}`,
        lastModified: UPDATED_AT[path],
        changeFrequency,
        priority,
        alternates: { languages },
      };
    }),
  );
}
