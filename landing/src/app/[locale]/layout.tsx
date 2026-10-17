import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { resolveLocale } from "@/i18n/page";
import { routing } from "@/i18n/routing";
import { OG_LOCALE, SITE_URL, localizedPath } from "@/i18n/seo";

import "../globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Each page adds its own title and alternates (canonical + hreflang, see i18n/seo.ts).
export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("shortDescription"),
      url: localizedPath(locale, "/"),
      siteName: "Clozer",
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("shortDescription"),
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  return (
    <html lang={locale} className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {/* Locale only: next-intl's links need it on the client. The copy is rendered on the server, no messages ship. */}
        <NextIntlClientProvider locale={locale} messages={null}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
