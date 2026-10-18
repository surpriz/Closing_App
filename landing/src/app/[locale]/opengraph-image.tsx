import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { BRAND } from "@/components/brand-colors";
import { READING_PAGES } from "@/components/thermal-reading-data";
import { routing } from "@/i18n/routing";

const size = { width: 1200, height: 630 };

function localeOf(value: string) {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

// One image per locale; generateImageMetadata is what lets the alt text follow the language.
export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: localeOf(params.locale), namespace: "meta" });
  return [{ id: "card", alt: t("title"), size, contentType: "image/png" }];
}


function plateBackground(heat: number) {
  if (heat === 0) return BRAND.iron0;
  const stops = [
    heat > 0.9 ? `${BRAND.iron4} 0%` : null,
    heat > 0.7 ? `${BRAND.iron3} ${heat > 0.9 ? 14 : 0}%` : null,
    heat > 0.35 ? `${BRAND.iron2} ${heat > 0.7 ? 32 : 0}%` : null,
    `${BRAND.iron1} ${heat > 0.35 ? 55 : 0}%`,
    `${BRAND.iron0} ${Math.round(60 + heat * 30)}%`,
  ].filter(Boolean);
  return `radial-gradient(circle at 50% 45%, ${stops.join(", ")})`;
}

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: localeOf(locale), namespace: "meta" });
  const tr = await getTranslations({ locale: localeOf(locale), namespace: "reading" });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BRAND.paper,
          color: BRAND.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 64px 40px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
            {/* Same mark as components/logo.tsx: a reticle closing on one hot spot. */}
            <svg width="40" height="40" viewBox="0 0 24 24">
              <path d="M3 8.5V3h5.5M15.5 3H21v5.5M21 15.5V21h-5.5M8.5 21H3v-5.5" fill="none" stroke={BRAND.ink} strokeWidth="2.4" />
              <circle cx="12" cy="12" r="3.4" fill={BRAND.iron2} />
            </svg>
            clozer
          </div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3, maxWidth: 900 }}>
            {t("ogHeadline")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, background: BRAND.ink, borderTop: `2px solid ${BRAND.ink}`, height: 230 }}>
          {/* The four pages of the sample proposal, heated as in the hero. */}
          {READING_PAGES.map((page) => (
            <div
              key={page.key}
              style={{
                display: "flex",
                flex: 1,
                padding: "22px 24px",
                backgroundImage: plateBackground(page.heat),
                backgroundColor: BRAND.iron0,
                color: BRAND.sheet,
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {tr(`pages.${page.key}.heading`)}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
