import { ImageResponse } from "next/og";

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
          background: "#f7f8fa",
          color: "#0f1e33",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#0f1e33",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#e8492e" }} />
            </div>
            Clozer
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 620 }}>
              Sachez qui lit votre devis.
            </div>
            <div style={{ fontSize: 34, color: "#5b6b82", maxWidth: 600 }}>Relancez au bon moment.</div>
          </div>
        </div>
        <div
          style={{
            width: 400,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
            background: "#ffffff",
            borderRadius: 28,
            padding: 40,
            border: "1px solid #e3e8ef",
          }}
        >
          {BARS.map((bar) => (
            <div key={bar.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 22, color: bar.hot ? "#0f1e33" : "#5b6b82" }}>{bar.label}</div>
              <div style={{ display: "flex", height: 12, borderRadius: 6, background: "#edf1f6" }}>
                <div
                  style={{
                    width: `${bar.width}%`,
                    height: 12,
                    borderRadius: 6,
                    background: bar.hot ? "#e3a03a" : "#0f1e33",
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
