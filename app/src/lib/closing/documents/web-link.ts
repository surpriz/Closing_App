// Pure helpers for URL documents (Notion, Loom, Figma...). No network here,
// see inspect-web-link.ts for the fetch.

// Accepts "notion.so/x" as well as a full URL; http(s) only
export function parseWebUrl(input: string): URL | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // A bare word ("devis") is not a link
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url;
  } catch {
    return null;
  }
}

function host(url: URL) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

/**
 * Embed URL for providers whose share link refuses framing but offer an
 * embed player. Null when the provider is unknown: the page itself is framed
 * if its headers allow it.
 */
export function knownEmbedUrl(url: URL): string | null {
  const h = host(url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (h === "loom.com" && parts[0] === "share" && parts[1]) {
    return `https://www.loom.com/embed/${parts[1]}`;
  }
  if (h === "youtube.com" && url.searchParams.get("v")) {
    return `https://www.youtube.com/embed/${url.searchParams.get("v")}`;
  }
  if (h === "youtu.be" && parts[0]) {
    return `https://www.youtube.com/embed/${parts[0]}`;
  }
  if (h === "vimeo.com" && parts[0] && /^\d+$/.test(parts[0])) {
    return `https://player.vimeo.com/video/${parts[0]}`;
  }
  if (h === "figma.com" && ["file", "design", "proto", "board", "slides", "deck"].includes(parts[0] ?? "")) {
    return `https://www.figma.com/embed?embed_host=clozer&url=${encodeURIComponent(url.toString())}`;
  }
  if (h === "docs.google.com" && ["document", "presentation", "spreadsheets"].includes(parts[0] ?? "")) {
    const id = parts[1] === "d" ? parts[2] : null;
    if (id) return `https://docs.google.com/${parts[0]}/d/${id}/preview`;
  }
  // Published Notion pages refuse framing, their /ebd/ twin is made for it
  if (h.endsWith(".notion.site")) {
    const id = parts.at(-1)?.match(/([0-9a-f]{32})$/i)?.[1];
    if (id && parts[0] !== "ebd") return `https://${url.hostname}/ebd/${id}`;
  }
  if (h === "canva.com" && parts[0] === "design" && parts[1]) {
    return `https://www.canva.com/design/${parts[1]}/view?embed`;
  }
  return null;
}

/**
 * Whether response headers let another origin frame the page.
 * X-Frame-Options DENY / SAMEORIGIN, or a CSP frame-ancestors list that
 * does not include us, block it.
 */
export function framingAllowed(headers: Headers, appOrigin: string): boolean {
  const xfo = headers.get("x-frame-options")?.trim().toLowerCase();
  if (xfo === "deny" || xfo === "sameorigin") return false;

  const csp = headers.get("content-security-policy");
  const directive = csp
    ?.split(",")
    .flatMap((policy) => policy.split(";"))
    .map((d) => d.trim())
    .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
  if (!directive) return true;

  const sources = directive.split(/\s+/).slice(1);
  if (sources.includes("*")) return true;
  const app = new URL(appOrigin);
  return sources.some((source) => {
    if (source === "'none'" || source === "'self'") return false;
    if (/^[a-z]+:$/i.test(source)) return source.toLowerCase() === app.protocol;
    const bare = source.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (bare.startsWith("*.")) return app.host.endsWith(bare.slice(1));
    return bare === app.host;
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name]);
}

// og:title first (Notion, Figma put the real name there), then <title>
export function extractPageTitle(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  const raw = og?.[1] ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const title = raw ? decodeEntities(raw).replace(/\s+/g, " ").trim() : "";
  return title ? title.slice(0, 200) : null;
}

// Fallback when the page gives no title: "Offre Acme" from a Notion-style
// slug, else "acme.com/offre"
export function fallbackName(url: URL) {
  const last = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let slug = last;
  try {
    slug = decodeURIComponent(last);
  } catch {}
  const words = slug
    .replace(/-?[0-9a-f]{32}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (words && words !== slug) return words.slice(0, 200);
  const path = url.pathname.replace(/\/$/, "");
  return `${host(url)}${path}`.slice(0, 200);
}
