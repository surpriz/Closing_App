import { getTranslations } from "next-intl/server";

import { MONTHLY_PRICE } from "@/content/pricing";
import { SITE_URL, localizedPath } from "@/i18n/seo";
import type { Locale } from "@/i18n/routing";

/** What Google reads about the product: name, category, price range (euros excl. VAT, per month). */
export async function SoftwareStructuredData({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "meta" });
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Clozer",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizedPath(locale, "/")}`,
    description: t("description"),
    inLanguage: locale,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: 0,
      highPrice: MONTHLY_PRICE.team.month,
    },
  };
  return (
    <script
      type="application/ld+json"
      // Escaped so a "<" in the copy can never close the script tag
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
