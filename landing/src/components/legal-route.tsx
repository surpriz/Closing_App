import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";

import { resolveLocale } from "@/i18n/page";
import type { AppPathname, Locale } from "@/i18n/routing";
import { alternatesFor } from "@/i18n/seo";

import { LegalPage } from "./legal-page";

type Props = { params: Promise<{ locale: string }> };

/**
 * One text page of the site in every locale: metadata with hreflang, and the frame around the content.
 * `translated`: the French text is the one that binds, the other versions say so at the top.
 */
export function legalRoute({
  path,
  messages,
  content,
  translated = false,
}: {
  path: Exclude<AppPathname, "/">;
  messages: "terms" | "privacy" | "notice" | "subprocessors" | "support";
  content: Record<Locale, ComponentType>;
  translated?: boolean;
}) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const locale = await resolveLocale(params);
    const t = await getTranslations({ locale, namespace: `legal.${messages}` });
    return { title: `${t("title")} — Clozer`, description: t("description"), alternates: alternatesFor(locale, path) };
  }

  async function Page({ params }: Props) {
    const locale = await resolveLocale(params);
    const t = await getTranslations({ locale, namespace: `legal.${messages}` });
    const Content = content[locale];
    return (
      <LegalPage locale={locale} path={path} title={t("title")} translated={translated}>
        <Content />
      </LegalPage>
    );
  }

  return { generateMetadata, Page };
}
