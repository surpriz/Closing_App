// How the link looks in the email: a framed card, or a plain line of text.
// Lives here, not in preferences.ts, so the Outlook add-in can import this file without WXT.
import { COPY } from "./copy";

export type LinkStyle = "card" | "text";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// What lands in the email. Card: a small framed block with the title and a call to
// open it, as a table with inline styles (the form Gmail and Outlook render alike).
// Text: one plain underlined line. Plain words only: nothing may hint that reading is followed.
// Colours are the app's graphite as hex (ink, soft ink, hairline): email clients ignore CSS
// variables. Near-square corners, no colour: the prospect's inbox gets a ruled card, not a badge.
export function linkHtml(url: string, title: string, style: LinkStyle = "card") {
  const href = escapeHtml(url);
  if (style === "text") {
    return `<div><a href="${href}">&#128196;&nbsp;${escapeHtml(title)}</a></div><div><br></div>`;
  }
  return (
    `<div><table cellpadding="0" cellspacing="0" role="presentation" ` +
    `style="border:1px solid #d7d9dc;border-radius:4px;border-collapse:separate;margin:8px 0">` +
    `<tr><td style="padding:12px 18px 12px 14px;font-family:Arial,Helvetica,sans-serif">` +
    `<a href="${href}" style="text-decoration:none;color:#18191d;font-size:15px;font-weight:bold">${escapeHtml(title)}</a><br>` +
    `<a href="${href}" style="text-decoration:underline;color:#55585e;font-size:13px">${escapeHtml(COPY.viewDocument)} &rarr;</a>` +
    `</td></tr></table></div><div><br></div>`
  );
}
