import { textToHtml, type TitledLink } from "./text-html";

// Both flavours: a mail app pastes the HTML (the title, clickable), a chat or SMS the plain text
async function copyRich(text: string, html: string) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
    return navigator.clipboard.writeText(text);
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

/** The link alone: pasted in an email it reads as its title, elsewhere as its address. */
export function copyLink(link: TitledLink) {
  return copyRich(link.url, textToHtml(link.url, link).replace(/^<p>|<\/p>$/g, ""));
}

/** A whole message: its proposal address reads as the title once pasted in an email. */
export function copyMessage(text: string, link?: TitledLink | null) {
  if (!link) return navigator.clipboard.writeText(text);
  return copyRich(text, textToHtml(text, link));
}
