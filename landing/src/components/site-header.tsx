import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { AppPathname, Locale } from "@/i18n/routing";

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
  const nav = [
    { href: `${home}#comment`, label: t("how") },
    { href: `${home}#relances`, label: t("followUps") },
    { href: `${home}#pour-qui`, label: t("who") },
    { href: `${home}#faq`, label: t("faq") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-ink bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-[90rem] items-stretch px-5 sm:px-8">
        <Link href="/" aria-label={t("home")} className="flex items-center pr-6">
          <Logo />
        </Link>
        <nav aria-label={t("label")} className="hidden items-stretch border-l border-rule md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center border-r border-rule px-4 text-small text-ink-soft transition-colors hover:bg-sheet hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher locale={locale} path={path} className="hidden px-3 text-small text-ink-soft sm:flex" />
          <a
            href={appUrl(locale)}
            className="hidden h-10 items-center px-3 text-small font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
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
