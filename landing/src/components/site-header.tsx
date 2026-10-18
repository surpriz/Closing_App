import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { AppPathname, Locale } from "@/i18n/routing";
import { localizedPath } from "@/i18n/seo";

import { ANCHORS } from "./anchors";
import { PrimaryCta } from "./cta";
import { appUrl } from "./links";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

/** The report's header strip: one hairline row, fields separated like a form. */
export async function SiteHeader({ locale, path }: { locale: Locale; path: AppPathname }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  // Plain anchors to the home sections: they must work from the legal pages too.
  const home = `/${locale}`;
  const sections = (["how", "features", "teams", "faq"] as const).map((section) => ({
    href: `${home}#${ANCHORS[locale][section]}`,
    label: t(section),
    current: false,
    // Six links don't fit next to the CTA at 1024px: "For teams" and the FAQ wait for xl (pricing covers the first).
    wide: section === "teams" || section === "faq",
  }));
  // The pages of their own in the nav, after the features they put in situation.
  const nav = [
    ...sections.slice(0, 2),
    { href: localizedPath(locale, "/use-cases"), label: t("useCases"), current: path === "/use-cases", wide: false },
    { href: localizedPath(locale, "/pricing"), label: t("pricing"), current: path === "/pricing", wide: false },
    ...sections.slice(2),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-ink bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-[90rem] items-stretch px-5 sm:px-8">
        <Link href="/" aria-label={t("home")} className="flex items-center pr-6">
          <Logo />
        </Link>
        <nav aria-label={t("label")} className="hidden items-stretch border-l border-rule lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={`flex items-center border-r border-rule px-4 text-small whitespace-nowrap text-ink-soft transition-colors hover:bg-sheet hover:text-ink aria-[current=page]:bg-sheet aria-[current=page]:font-medium aria-[current=page]:text-ink ${item.wide ? "max-xl:hidden" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher locale={locale} path={path} className="hidden px-3 text-small text-ink-soft sm:flex" />
          <a
            href={appUrl(locale)}
            className="hidden h-10 items-center px-3 text-small font-medium whitespace-nowrap text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            {t("login")}
          </a>
          <PrimaryCta locale={locale}>{t("try")}</PrimaryCta>
          <MobileMenu
            items={nav}
            loginHref={appUrl(locale)}
            labels={{ nav: t("label"), open: t("openMenu"), close: t("closeMenu"), login: t("login") }}
            cta={<PrimaryCta locale={locale}>{t("try")}</PrimaryCta>}
            switcher={<LocaleSwitcher locale={locale} path={path} className="py-2 text-body font-medium text-ink-soft" />}
          />
        </div>
      </div>
    </header>
  );
}
