/**
 * The design tokens of globals.css as sRGB hex, for the places that cannot read oklch:
 * the Open Graph image (Satori) and anything else drawn outside the CSS.
 * Keep in sync with @theme in app/globals.css.
 */
export const BRAND = {
  paper: "#f7f9fc",
  sheet: "#ffffff",
  ink: "#101e33",
  inkSoft: "#576478",
  muted: "#edf0f6",
  rule: "#e1e5ea",
  brand: "#2e62c9",
  success: "#187c49",
  heatHot: "#e94a2b",
  heatWarm: "#e9a03e",
  heatCold: "#8ca7ca",
} as const;
