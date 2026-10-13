// Drawn marks, as SVG nodes (the app's LogoMark, app/src/components/brand/logo.tsx).
// Ink is currentColor; the one colour is the hot spot, on --iron-2.

const NS = "http://www.w3.org/2000/svg";

function svg(size: number, ...children: SVGElement[]) {
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("focusable", "false");
  el.append(...children);
  return el;
}

function node(tag: string, attrs: Record<string, string>) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

/** A measuring reticle closing on one hot spot: where the quote heats up. */
export function logoMark(size = 20) {
  return svg(
    size,
    node("path", {
      d: "M3 8.5V3h5.5M15.5 3H21v5.5M21 15.5V21h-5.5M8.5 21H3v-5.5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2.4",
      "stroke-linecap": "square",
    }),
    node("circle", { cx: "12", cy: "12", r: "3.4", style: "fill: var(--iron-2)" }),
  );
}

/** Reticle and lowercase wordmark, as in the app header. */
export function logo(size = 20) {
  const el = document.createElement("span");
  el.className = "logo";
  const word = document.createElement("span");
  word.className = "wordmark";
  word.textContent = "clozer";
  el.append(logoMark(size), word);
  return el;
}

export function closeIcon(size = 14) {
  return svg(size, node("path", { d: "M6 6l12 12M18 6L6 18", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "square" }));
}
