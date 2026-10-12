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

export type VideoProvider = "youtube" | "vimeo" | "loom";

/** The video player behind an embed URL, whose playback the viewer can follow. */
export function videoProvider(embedUrl: string | null): VideoProvider | null {
  if (!embedUrl) return null;
  let url: URL;
  try {
    url = new URL(embedUrl);
  } catch {
    return null;
  }
  const h = host(url);
  if (h === "youtube.com" && url.pathname.startsWith("/embed/")) return "youtube";
  if (h === "player.vimeo.com") return "vimeo";
  if (h === "loom.com" && url.pathname.startsWith("/embed/")) return "loom";
  return null;
}

/** What the viewer frames: YouTube only talks to the page once its JS API is on. */
export function playerSrc(embedUrl: string) {
  if (videoProvider(embedUrl) !== "youtube") return embedUrl;
  const url = new URL(embedUrl);
  url.searchParams.set("enablejsapi", "1");
  return url.toString();
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

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", laquo: "«", raquo: "»",
  hellip: "…", mdash: "—", ndash: "–", euro: "€", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
};

// A made-up entity like &#99999999999; must not throw
function fromCodePoint(code: number) {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (entity, code: string) => fromCodePoint(Number(code)) ?? entity)
    .replace(/&#x([0-9a-f]+);/gi, (entity, code: string) => fromCodePoint(parseInt(code, 16)) ?? entity)
    .replace(/&([a-z]+|#39);/gi, (entity, name: string) => ENTITIES[name] ?? entity);
}

/** A <meta> content, whichever order its attributes come in. Apostrophes inside "…" are kept. */
function metaContent(html: string, attribute: "name" | "property", value: string) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
    if (key?.toLowerCase() !== value) continue;
    const content = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (content !== undefined) return content;
  }
  return null;
}

// og:title first (Notion, Figma put the real name there), then <title>
export function extractPageTitle(html: string): string | null {
  const raw = metaContent(html, "property", "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const title = raw ? decodeEntities(raw).replace(/\s+/g, " ").trim() : "";
  return title ? title.slice(0, 200) : null;
}

// Fallback when the page gives no title: "Offre Acme" from a Notion-style
// slug, else "acme.com/offre"
function metaDescription(html: string) {
  const content = metaContent(html, "name", "description");
  return content ? decodeEntities(content).trim() : "";
}

// Raw text blocks end at their first closing tag; nav, footer and svg can nest
const HIDDEN_TAGS = /<(\/?)(script|style|noscript|template|iframe|svg|nav|footer)\b[^>]*>/gi;
const NESTING = new Set(["svg", "nav", "footer"]);

/** Drops what a reader does not read (code, menus, footers) in one pass, even on broken HTML. */
function stripHiddenBlocks(html: string) {
  let out = "";
  let last = 0;
  let hidden: string | null = null;
  let depth = 0;
  for (const match of html.matchAll(HIDDEN_TAGS)) {
    const [tag, closing, rawName] = match;
    const name = rawName.toLowerCase();
    if (hidden === null) {
      if (closing) continue;
      out += `${html.slice(last, match.index)} `;
      hidden = name;
      depth = 1;
    } else if (name === hidden && (closing || NESTING.has(name))) {
      depth += closing ? -1 : 1;
      if (depth === 0) {
        hidden = null;
        last = match.index + tag.length;
      }
    }
  }
  // An unclosed block hides the rest of the page
  return hidden === null ? out + html.slice(last) : out;
}
const BLOCK_TAGS = /<\/?(p|div|section|article|main|header|h[1-6]|li|ul|ol|tr|table|br|hr|blockquote)\b[^>]*>/gi;

/**
 * Readable text of a page, for the AI reading and the prospect assistant.
 * Pages rendered in the browser (Notion workspaces, apps) give little or nothing.
 */
export function htmlToText(html: string, max = 20_000) {
  const body = html.match(/<body[^>]*>([\s\S]*)/i)?.[1] ?? html;
  const text = decodeEntities(
    stripHiddenBlocks(body)
      // An unclosed comment runs to the end: one match, no backtracking over the page
      .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
      .replace(BLOCK_TAGS, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  const description = metaDescription(html);
  const full = description && !text.includes(description) ? [description, text].filter(Boolean).join("\n") : text;
  return full.replace(/\u0000/g, "").slice(0, max);
}

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
