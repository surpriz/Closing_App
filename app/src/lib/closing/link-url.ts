import { documentTitle, linkTitle } from "./documents/link-title";

/**
 * Public address of a link: /v/acme-devis-renovation-cuisine-mHiTw7Wdh4uT.
 * Only the random slug after the last dash opens the document. The words before
 * it are for the prospect and are worked out each time, so a company added after
 * the link was copied changes nothing for the addresses already sent. Pure.
 */

const SLUG = /^[A-Za-z0-9]{6,32}$/;
const PREFIX_MAX = 48;

export type UrlLink = {
  slug: string;
  document?: { name: string; displayTitle?: string | null; docType?: string | null } | null;
  /** The prospect's company, never their email: the address may be forwarded. */
  company?: string | null;
};

// "Acme Group", "Devis rénovation cuisine" → "acme-group-devis-renovation-cuisine"
export function slugPrefix(parts: (string | null | undefined)[]) {
  const words = parts
    .filter((part): part is string => !!part?.trim())
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // The company often opens the title too: "Acme" + "Acme – devis" says it once
  const unique = words.filter((word, i) => words.indexOf(word) === i);
  let prefix = "";
  for (const word of unique) {
    const next = prefix ? `${prefix}-${word}` : word;
    if (next.length > PREFIX_MAX) break;
    prefix = next;
  }
  return prefix;
}

export function viewerPath(link: UrlLink) {
  const title = link.document ? documentTitle(link.document) : null;
  const prefix = slugPrefix([link.company, title === "Document" ? null : title]);
  return `/v/${prefix ? `${prefix}-` : ""}${link.slug}`;
}

export function viewerUrl(origin: string, link: UrlLink) {
  return `${origin}${viewerPath(link)}`;
}

export type CopiedLink = { url: string; title: string };

/** The address, and the words the prospect clicks on in the email ("Devis rénovation cuisine – Acme"). */
export function shareLink(origin: string, link: UrlLink & { document: NonNullable<UrlLink["document"]> }): CopiedLink {
  return { url: viewerUrl(origin, link), title: linkTitle({ ...link.document, company: link.company }) };
}

// "acme-devis-mHiTw7Wdh4uT" → "mHiTw7Wdh4uT". Older links have no words: kept as is. Null when no slug.
export function bareSlug(param: string) {
  const slug = param.slice(param.lastIndexOf("-") + 1);
  return SLUG.test(slug) ? slug : null;
}
