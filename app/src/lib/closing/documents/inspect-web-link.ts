import { resolvesToPublicAddress } from "../channels/public-address";
import { isSafeOutboundUrl } from "../channels/webhooks";
import { extractPageTitle, fallbackName, framingAllowed, htmlToText, knownEmbedUrl, videoProvider } from "./web-link";

const MAX_REDIRECTS = 5;
const MAX_HEAD_BYTES = 256 * 1024;
const MAX_PAGE_BYTES = 1536 * 1024;

export type WebLinkInfo = {
  name: string;
  /** What the viewer frames; null when the site refuses framing. */
  embedUrl: string | null;
};

// Reads at most maxBytes of HTML, stopping after <head> when that is all we need
async function readHtml(response: Response, maxBytes: number, headOnly: boolean) {
  if (!response.body || !response.headers.get("content-type")?.includes("html")) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (headOnly && /<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return html;
}

// Follows redirects by hand so each hop goes through the SSRF guard, DNS included
async function fetchPage(url: URL) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeOutboundUrl(current.toString()) || !(await resolvesToPublicAddress(current.hostname))) return null;
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        // Some sites answer bots with a bare page; look like a browser
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8_000),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => {});
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  return null;
}

/**
 * Names the page and decides how the viewer shows it. Never throws: an
 * unreachable page is still accepted, the prospect opens it in a new tab.
 */
export async function inspectWebLink(url: URL, appOrigin: string): Promise<WebLinkInfo> {
  const known = knownEmbedUrl(url);
  try {
    const response = await fetchPage(url);
    const html = response?.ok ? await readHtml(response, MAX_HEAD_BYTES, true) : "";
    if (response && !response.ok) await response.body?.cancel().catch(() => {});
    const name = extractPageTitle(html) ?? fallbackName(url);
    if (known) return { name, embedUrl: known };
    const embeddable = !!response?.ok && framingAllowed(response.headers, appOrigin);
    return { name, embedUrl: embeddable ? url.toString() : null };
  } catch (error) {
    console.warn(`[documents] could not inspect ${url.hostname}`, error);
    return { name: fallbackName(url), embedUrl: known };
  }
}

const OEMBED: Record<string, string> = {
  youtube: "https://www.youtube.com/oembed?format=json&url=",
  vimeo: "https://vimeo.com/api/oembed.json?url=",
  loom: "https://www.loom.com/v1/oembed?url=",
};

// A video page has no readable text: its title, author and description say what it is about
async function videoText(url: URL, provider: string) {
  const response = await fetch(`${OEMBED[provider]}${encodeURIComponent(url.toString())}`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { title?: string; author_name?: string; description?: string };
  return [
    data.title && `Vidéo : ${data.title}`,
    data.author_name && `Auteur : ${data.author_name}`,
    data.description,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 20_000);
}

/**
 * The text of a web page for the AI reading and the prospect assistant.
 * Empty when the page has no readable text (rendered in the browser), null
 * when it could not be fetched: what was read before is then kept. Never throws.
 */
export async function readWebText(url: URL): Promise<string | null> {
  try {
    const provider = videoProvider(knownEmbedUrl(url));
    if (provider) return await videoText(url, provider);
    const response = await fetchPage(url);
    if (!response?.ok) {
      await response?.body?.cancel().catch(() => {});
      return null;
    }
    return htmlToText(await readHtml(response, MAX_PAGE_BYTES, false));
  } catch (error) {
    console.warn(`[documents] could not read ${url.hostname}`, error);
    return null;
  }
}
