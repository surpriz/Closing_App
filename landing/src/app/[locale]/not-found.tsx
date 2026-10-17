import { getLocale, getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} path="/" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-24 sm:px-6">
        <h1 className="text-title font-medium text-ink [font-stretch:92%]">{t("title")}</h1>
        <p className="mt-4 text-body text-ink-soft">{t("body")}</p>
        <p className="mt-8">
          <Link href="/" className="font-medium text-ink underline underline-offset-4">
            {t("back")}
          </Link>
        </p>
      </main>
      <SiteFooter locale={locale} path="/" />
    </div>
  );
}
