import { ImageResponse } from "next/og";

import { BRAND } from "@/components/brand-colors";

export const alt = "Clozer — savoir qui lit vraiment votre devis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Heat per page of the example quote, as on the home page.
const PLATES = [0.3, 0.5, 0.68, 1, 0.38, 0];

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

export default function OpengraphImage() {
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
            Voyez où votre devis chauffe.
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, background: BRAND.ink, borderTop: `2px solid ${BRAND.ink}`, height: 230 }}>
          {PLATES.map((heat, i) => (
            <div key={i} style={{ display: "flex", flex: 1, backgroundImage: plateBackground(heat), backgroundColor: BRAND.iron0 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
