import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { AppPathname, Locale } from "@/i18n/routing";

import { CONTACT_EMAIL } from "./links";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";

export async function SiteFooter({ locale, path }: { locale: Locale; path: AppPathname }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const legalLinks = [
    { href: "/privacy", label: t("privacy") },
    { href: "/terms", label: t("terms") },
    { href: "/security", label: t("security") },
    { href: "/subprocessors", label: t("subprocessors") },
    { href: "/legal", label: t("legal") },
    { href: "/support", label: t("support") },
  ] as const;

  return (
    <footer className="border-t border-ink">
      <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-6 px-5 py-8 text-small text-ink-soft sm:px-8">
        <Logo />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
              {link.label}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
            {CONTACT_EMAIL}
          </a>
          <LocaleSwitcher locale={locale} path={path} />
        </div>
      </div>
    </footer>
  );
}
