import { looksLikePdf } from "@ext/pdf";
import { toRecipient, type Recipient } from "@ext/recipients";

// Pure helpers on what Outlook hands us. No Office.js here, so they are tested as is.

// attachmentType: "file" | "item" | "cloud", or 0 / 1 / 2 in the event details on Mac
export type AttachmentInfo = { id: string; name: string; contentType?: string; attachmentType?: string | number; isInline?: boolean };

// A PDF the seller attached from disk. Cloud (OneDrive) and item attachments are left alone.
export function isPdfAttachment(attachment: AttachmentInfo | null | undefined) {
  if (!attachment?.id || attachment.isInline) return false;
  const type = attachment.attachmentType;
  if (type !== undefined && type !== "file" && type !== 0 && type !== "0") return false;
  return looksLikePdf({ name: attachment.name ?? "", type: attachment.contentType ?? "" });
}

export function firstRecipient(to: { emailAddress?: string; displayName?: string }[] | null | undefined): Recipient | null {
  for (const entry of to ?? []) {
    const recipient = toRecipient(entry.emailAddress ?? null, entry.displayName ?? null);
    if (recipient) return recipient;
  }
  return null;
}

export function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Links inserted in this email, kept on the compose session for the send handler
export type InsertedLink = { id: string; url: string };

export function parseLinks(value: string | null | undefined): InsertedLink[] {
  try {
    const parsed = JSON.parse(value ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((link): link is InsertedLink => typeof link?.id === "string" && typeof link?.url === "string")
      : [];
  } catch {
    return [];
  }
}

export function addLink(links: InsertedLink[], link: InsertedLink) {
  return [...links.filter((existing) => existing.id !== link.id), link];
}

// The seller may have deleted a link before sending: only the ones still in the body start a deal.
// Outlook may rewrite & as &amp; in the HTML, hence the slug check rather than the full URL.
export function linksInBody(links: InsertedLink[], body: string) {
  return links.filter((link) => {
    const slug = link.url.split("/v/")[1];
    return body.includes(link.url) || (!!slug && body.includes(`/v/${slug}`));
  });
}

// contextData of the "Replace" action on the attachment notice
export function parseContext(value: string | null | undefined): { attachmentId?: string } {
  try {
    const parsed = JSON.parse(value ?? "{}") as { attachmentId?: unknown };
    return typeof parsed.attachmentId === "string" ? { attachmentId: parsed.attachmentId } : {};
  } catch {
    return {};
  }
}
