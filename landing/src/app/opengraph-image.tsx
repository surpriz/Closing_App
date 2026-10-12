import { ImageResponse } from "next/og";

import { BRAND } from "@/components/brand-colors";

export const alt = "Clozer — savoir qui lit vraiment votre devis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [
  { label: "Contexte", width: 22 },
  { label: "Méthode", width: 38 },
  { label: "Tarifs", width: 100, hot: true },
  { label: "Conditions", width: 14 },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BRAND.paper,
          color: BRAND.ink,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700 }}>
            {/* Same mark as components/logo.tsx: an open ring that the hot dot closes. */}
            <svg width="44" height="44" viewBox="0 0 24 24">
              <path
                d="M19.07 7.5A8.5 8.5 0 1 0 19.07 16.5"
                fill="none"
                stroke={BRAND.ink}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="20.2" cy="12" r="2.2" fill={BRAND.heatHot} />
            </svg>
            Clozer
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 620 }}>
              Sachez qui lit votre devis.
            </div>
            <div style={{ fontSize: 34, color: BRAND.inkSoft, maxWidth: 600 }}>Relancez au bon moment.</div>
          </div>
        </div>
        <div
          style={{
            width: 400,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
            background: BRAND.sheet,
            borderRadius: 28,
            padding: 40,
            border: `1px solid ${BRAND.rule}`,
          }}
        >
          {BARS.map((bar) => (
            <div key={bar.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 22, color: bar.hot ? BRAND.ink : BRAND.inkSoft }}>{bar.label}</div>
              <div style={{ display: "flex", height: 12, borderRadius: 6, background: BRAND.muted }}>
                <div
                  style={{
                    width: `${bar.width}%`,
                    height: 12,
                    borderRadius: 6,
                    background: bar.hot ? BRAND.heatHot : BRAND.ink,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
