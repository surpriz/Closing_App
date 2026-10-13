import archivo from "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?inline";
import geistMono from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?inline";

// The in-page panel lives in a shadow root, where @font-face does not register, and Gmail's
// CSP may refuse font URLs. So the two faces ship inside the content script and are handed
// to the page's font set as bytes, under names no mail client uses. Latin subset only.
let loaded = false;

function bytes(dataUrl: string) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

export function loadInPageFonts() {
  if (loaded || typeof FontFace === "undefined") return;
  loaded = true;
  try {
    for (const [family, data] of [
      ["Clozer Archivo", archivo],
      ["Clozer Geist Mono", geistMono],
    ] as const) {
      const face = new FontFace(family, bytes(data), { weight: "100 900", display: "swap" });
      document.fonts.add(face);
      void face.load().catch(() => undefined);
    }
  } catch {
    // The system stack in --font-sans takes over
  }
}
