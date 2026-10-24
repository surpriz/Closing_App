/** A message's address read as its title: "Devis rénovation cuisine – Acme", clickable. */
export type TitledLink = { url: string; title: string };

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Any address of the link's site under /v/, query included (?r= credits a follow-up), not the full stop after it
function viewerAddresses(url: string) {
  const origin = new URL(url).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${origin}/v/[A-Za-z0-9-]+(?:\\?[^\\s<>"]*[^\\s<>".,;:!?)])?`, "g");
}

/**
 * Plain text as email HTML, paragraph by paragraph. With `link`, every address of
 * the proposal in it reads as the link's title: the prospect never sees a raw URL. Pure.
 */
export function textToHtml(text: string, link?: TitledLink | null) {
  const pattern = link ? viewerAddresses(link.url) : null;
  const html = (part: string) => {
    if (!pattern || !link) return escapeHtml(part);
    let out = "";
    let last = 0;
    for (const match of part.matchAll(pattern)) {
      out += escapeHtml(part.slice(last, match.index));
      out += `<a href="${escapeHtml(match[0])}">${escapeHtml(link.title)}</a>`;
      last = match.index + match[0].length;
    }
    return out + escapeHtml(part.slice(last));
  };
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${html(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
