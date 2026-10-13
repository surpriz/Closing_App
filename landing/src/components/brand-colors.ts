/**
 * The design tokens of globals.css as sRGB hex, for the places that cannot read oklch:
 * the Open Graph image (Satori) and anything else drawn outside the CSS.
 * Keep in sync with @theme in app/globals.css.
 */
export const BRAND = {
  paper: "#f4f5f7",
  sheet: "#ffffff",
  ink: "#15171c",
  inkSoft: "#5a5e68",
  rule: "#d9dbe0",
  iron0: "#1b0b3a",
  iron1: "#7a1e8c",
  iron2: "#e2452b",
  iron3: "#ffc93c",
  iron4: "#fff6d8",
} as const;
