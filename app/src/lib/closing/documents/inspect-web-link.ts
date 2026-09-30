import { isSafeOutboundUrl } from "../channels/webhooks";
import { extractPageTitle, fallbackName, framingAllowed, knownEmbedUrl } from "./web-link";

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 256 * 1024;

export type WebLinkInfo = {
  name: string;
  /** What the viewer frames; null when the site refuses framing. */
  embedUrl: string | null;
};

// Reads at most MAX_HTML_BYTES, enough for <head>
async function readHead(response: Response) {
  if (!response.body || !response.headers.get("content-type")?.includes("html")) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return html;
}

// Follows redirects by hand so each hop goes through the SSRF guard
async function fetchPage(url: URL) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeOutboundUrl(current.toString())) return null;
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
    const html = response?.ok ? await readHead(response) : "";
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
