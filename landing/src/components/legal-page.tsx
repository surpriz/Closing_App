import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { AppPathname, Locale } from "@/i18n/routing";

import { UPDATED_AT } from "./page-dates";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// Shared frame for the legal pages: same typography as the privacy policy
export async function LegalPage({
  locale,
  path,
  title,
  translated = false,
  children,
}: {
  locale: Locale;
  path: AppPathname;
  title: string;
  /** The English version of a French legal text: say which one prevails. */
  translated?: boolean;
  children: ReactNode;
}) {
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "legal" }), getFormatter({ locale })]);
  const date = format.dateTime(UPDATED_AT[path], { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} path={path} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 text-body text-ink-soft sm:px-6 md:py-20 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
        {translated && locale !== "fr" && (
          <p className="!mt-0 mb-10 border-l-2 border-ink pl-4 text-small">
            {t.rich("translationNotice", {
              link: (chunks) => (
                <Link href={path} locale="fr" hrefLang="fr">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
        <h1 className="text-title font-medium text-ink [font-stretch:92%]">{title}</h1>
        <p>{t("updatedAt", { date })}</p>
        {children}
      </main>

      <SiteFooter locale={locale} path={path} />
    </div>
  );
}
