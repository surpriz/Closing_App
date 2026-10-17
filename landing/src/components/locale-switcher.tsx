import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";

// Each language named in itself.
const NAMES: Record<Locale, string> = { en: "English", fr: "Français" };

/** Links to the same page in the other languages. */
export async function LocaleSwitcher({ locale, path, className = "" }: { locale: Locale; path: AppPathname; className?: string }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  return (
    <nav aria-label={t("language")} className={`flex items-center gap-3 ${className}`}>
      {routing.locales
        .filter((other) => other !== locale)
        .map((other) => (
          <Link
            key={other}
            href={path}
            locale={other}
            hrefLang={other}
            lang={other}
            className="underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {NAMES[other]}
          </Link>
        ))}
    </nav>
  );
}
