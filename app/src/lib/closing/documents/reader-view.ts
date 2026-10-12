import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/** Below this, the page is an app or a landing with no article to show. */
const MIN_ARTICLE_CHARS = 400;
const MAX_READER_BYTES = 300 * 1024;

// Tags kept as they are, or renamed to their plain equivalent
const RENAMED: Record<string, string> = {
  h1: "h2",
  h5: "h4",
  h6: "h4",
  b: "strong",
  i: "em",
};
const KEPT = new Set([
  "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "em",
  "br", "hr", "figure", "figcaption", "img", "a", "table", "thead", "tbody", "tr", "th", "td",
]);
// Dropped with everything inside; any other tag is unwrapped, its children kept
const DROPPED = new Set([
  "script", "style", "noscript", "iframe", "object", "embed", "form", "input", "button",
  "select", "textarea", "svg", "video", "audio", "canvas", "template", "picture",
]);
const VOID = new Set(["br", "hr", "img"]);

type Node = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<Node> };
type Element = Node & { getAttribute(name: string): string | null };

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function absoluteUrl(value: string | null, base: URL, protocols: string[]) {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), base);
    return protocols.includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function imageSource(element: Element) {
  const srcset = element.getAttribute("srcset") ?? element.getAttribute("data-srcset");
  // The last candidate of a srcset is usually the largest
  const fromSet = srcset?.split(",").at(-1)?.trim().split(/\s+/)[0];
  return element.getAttribute("src") || element.getAttribute("data-src") || fromSet || null;
}

// Rebuilds the article from scratch with a short list of tags and attributes:
// nothing from the source page reaches the viewer unescaped
function serialize(node: Node, base: URL, inPre = false): string {
  // Source indentation means nothing outside <pre>
  if (node.nodeType === 3) return escape(inPre ? (node.textContent ?? "") : (node.textContent ?? "").replace(/\s+/g, " "));
  if (node.nodeType !== 1) return "";
  const name = node.nodeName.toLowerCase();
  if (DROPPED.has(name)) return "";
  const tag = RENAMED[name] ?? name;
  const children = () =>
    Array.from(node.childNodes, (child) => serialize(child, base, inPre || tag === "pre")).join("");
  if (!KEPT.has(tag)) return children();

  const element = node as Element;
  if (tag === "img") {
    // https only: an http image would be blocked as mixed content anyway
    const src = absoluteUrl(imageSource(element), base, ["https:"]);
    if (!src) return "";
    const alt = element.getAttribute("alt") ?? "";
    return `<img src="${escape(src)}" alt="${escape(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
  }
  if (tag === "a") {
    const href = absoluteUrl(element.getAttribute("href"), base, ["https:", "http:"]);
    if (!href) return children();
    return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer nofollow">${children()}</a>`;
  }
  if (VOID.has(tag)) return `<${tag}>`;
  const inner = children();
  // Wrappers left empty once their scripts and widgets are gone
  if (!inner.trim() && tag !== "td" && tag !== "th") return "";
  return `<${tag}>${inPre || tag === "pre" ? inner : inner.trim()}</${tag}>`;
}

/**
 * The article of a page that refuses to be framed, cleaned to plain HTML the
 * viewer can show in Clozer. Null when the page has no article (an app, a
 * landing made of widgets) or when it cannot be parsed.
 */
export function extractReaderHtml(html: string, pageUrl: URL): string | null {
  if (!html) return null;
  try {
    const { document } = parseHTML(html);
    // Read before Readability strips the head: most articles keep their photo there
    const cover = absoluteUrl(
      document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
      pageUrl,
      ["https:"],
    );
    const article = new Readability(document as unknown as Document, { charThreshold: MIN_ARTICLE_CHARS }).parse();
    if (!article?.content || (article.textContent ?? "").trim().length < MIN_ARTICLE_CHARS) return null;
    const { document: content } = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`);
    const cleaned = serialize(content.body as unknown as Node, pageUrl)
      .replace(/\s*(<\/?(?:p|h[2-4]|ul|ol|li|blockquote|figure|figcaption|table|thead|tbody|tr|hr)>)\s*/g, "$1")
      .trim();
    if (!cleaned || Buffer.byteLength(cleaned) > MAX_READER_BYTES) return null;
    if (!cover || cleaned.includes("<img")) return cleaned;
    return `<figure><img src="${escape(cover)}" alt="" referrerpolicy="no-referrer"></figure>${cleaned}`;
  } catch (error) {
    console.warn(`[documents] no reader view for ${pageUrl.hostname}`, error);
    return null;
  }
}
