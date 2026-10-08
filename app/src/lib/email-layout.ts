/**
 * Plain HTML layout for emails sent to sellers (alerts, morning digest).
 * Inline styles only, one column, works in Gmail and Outlook. Pure.
 */

export type EmailBlock =
  | { kind: "text"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: { text: string; detail?: string; href?: string }[] }
  | { kind: "button"; label: string; href: string };

export type EmailContent = {
  /** Shown by mail clients next to the subject. */
  preheader?: string;
  title: string;
  blocks: EmailBlock[];
  /** Small print under the content, e.g. a link to the notification settings. */
  footer?: { text: string; href?: string };
};

const INK = "#1c1917";
const MUTED = "#78716c";
const LINE = "#e7e5e4";
const BRAND = "#c2410c";

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string) {
  return escapeHtml(text).split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br>"));
}

function blockHtml(block: EmailBlock) {
  switch (block.kind) {
    case "text":
      return paragraphs(block.text)
        .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:${INK}">${p}</p>`)
        .join("");
    case "quote":
      return `<div style="margin:0 0 16px;padding:10px 14px;border-left:3px solid ${LINE};background:#fafaf9;font-size:15px;line-height:22px;color:${INK}">${paragraphs(block.text).join("<br><br>")}</div>`;
    case "heading":
      return `<p style="margin:22px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;color:${MUTED}">${escapeHtml(block.text)}</p>`;
    case "list":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${block.items
        .map((item) => {
          const label = item.href
            ? `<a href="${escapeHtml(item.href)}" style="color:${INK};font-weight:600;text-decoration:none">${escapeHtml(item.text)}</a>`
            : `<span style="font-weight:600">${escapeHtml(item.text)}</span>`;
          const detail = item.detail
            ? `<br><span style="color:${MUTED};font-size:14px">${escapeHtml(item.detail)}</span>`
            : "";
          return `<tr><td style="padding:8px 0;border-top:1px solid ${LINE};font-size:15px;line-height:21px;color:${INK}">${label}${detail}</td></tr>`;
        })
        .join("")}</table>`;
    case "button":
      return `<p style="margin:18px 0"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:${INK};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(block.label)}</a></p>`;
  }
}

function blockText(block: EmailBlock) {
  switch (block.kind) {
    case "text":
      return block.text;
    case "quote":
      return block.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "heading":
      return block.text.toUpperCase();
    case "list":
      return block.items
        .map((item) => [`- ${item.text}`, item.detail && `  ${item.detail}`, item.href && `  ${item.href}`].filter(Boolean).join("\n"))
        .join("\n");
    case "button":
      return `${block.label} : ${block.href}`;
  }
}

export function renderEmail(content: EmailContent) {
  const footer = content.footer
    ? `<p style="margin:28px 0 0;padding-top:14px;border-top:1px solid ${LINE};font-size:12px;color:${MUTED}">${
        content.footer.href
          ? `<a href="${escapeHtml(content.footer.href)}" style="color:${MUTED}">${escapeHtml(content.footer.text)}</a>`
          : escapeHtml(content.footer.text)
      }</p>`
    : "";
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>`
    : "";

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:0;background:#f5f5f4">${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><p style="margin:0 0 18px;font-size:13px;font-weight:700;color:${BRAND}">Clozer</p><h1 style="margin:0 0 16px;font-size:20px;line-height:27px;color:${INK}">${escapeHtml(content.title)}</h1>${content.blocks
    .map(blockHtml)
    .join("")}${footer}</td></tr></table></td></tr></table></body></html>`;

  const text = [content.title, "", ...content.blocks.map(blockText).flatMap((t) => [t, ""]), content.footer ? `${content.footer.text}${content.footer.href ? ` : ${content.footer.href}` : ""}` : ""]
    .join("\n")
    .trim();

  return { html, text };
}
