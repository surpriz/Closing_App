import type { MailHost } from "@/lib/messages";
import { extractEmail, toRecipient, type Recipient } from "@/lib/recipients";

// Gmail and Outlook web change their markup often. Everything here relies on
// structure and attributes rather than class names or UI language where possible,
// and every lookup may return null: the extension then does less, never breaks the compose.

type HostConfig = {
  // Ancestors that delimit one compose (popup dialog, inline reply, full page)
  roots: string[];
  // Recipient chips, in document order: the first one is the first "To"
  recipients: string;
  // Where the link must go before, so it stays above the signature and quoted text
  insertBefore: string[];
};

const CONFIG: Record<MailHost, HostConfig> = {
  gmail: {
    roots: ['div[role="dialog"]', ".M9", ".ip.adB", ".aoP"],
    recipients: '[data-hovercard-id*="@"], span[email], input[name="to"]',
    insertBefore: [".gmail_signature", "[data-smartmail='gmail_signature']", ".gmail_quote"],
  },
  outlook: {
    roots: ['[data-app-section="ComposeForm"]', '[aria-label][role="dialog"]', "#docking_InitVisiblePart_0"],
    // Persona chips carry the address in their label or tooltip
    recipients: '[data-lpc-hover-target-id*="@"], [aria-label*="@"], [title*="@"]',
    insertBefore: ["#Signature", "#signature", "#appendonsend", "#divRplyFwdMsg", "#mail-editor-reference-message-container"],
  },
};

const MIN_BODY_HEIGHT = 60;
const MAX_CLIMB = 14;
const REMOVE_LABEL = /remove|supprimer|retirer|enlever|entfernen|quitar|eliminar|rimuovi|verwijder/i;

// Message bodies: editable text boxes, and tall. Recipient and subject fields are short.
export function findBodies(doc: Document = document) {
  return Array.from(doc.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]')).filter(
    (el) => el.offsetHeight >= MIN_BODY_HEIGHT && !el.parentElement?.closest('[contenteditable="true"]'),
  );
}

export function composeRoot(host: MailHost, body: HTMLElement) {
  for (const selector of CONFIG[host].roots) {
    const root = body.closest<HTMLElement>(selector);
    if (root) return root;
  }
  // Fallback: the nearest ancestor that also holds the recipients. Stop before it
  // takes in another message (a thread), where the chips belong to someone else.
  let node: HTMLElement | null = body.parentElement;
  for (let i = 0; node && i < MAX_CLIMB; i++, node = node.parentElement) {
    if (node.querySelectorAll('[contenteditable="true"][role="textbox"]').length > 1) break;
    if (node.querySelector(CONFIG[host].recipients)) return node;
  }
  return body.parentElement ?? body;
}

// First address in the compose header, which is the first "To" recipient
export function firstRecipient(host: MailHost, root: HTMLElement, body: HTMLElement): Recipient | null {
  const candidates = root.querySelectorAll<HTMLElement>(CONFIG[host].recipients);
  for (const el of Array.from(candidates)) {
    // Only the header: addresses typed in the message, or shown after it, don't count
    if (body.contains(el) || body.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) continue;
    const email =
      extractEmail(el.getAttribute("data-hovercard-id")) ??
      extractEmail(el.getAttribute("data-lpc-hover-target-id")) ??
      extractEmail(el.getAttribute("email")) ??
      extractEmail(el.getAttribute("title")) ??
      extractEmail(el.getAttribute("aria-label")) ??
      extractEmail((el as HTMLInputElement).value);
    if (!email) continue;
    const label = el.getAttribute("data-name") ?? el.getAttribute("name") ?? el.textContent;
    return toRecipient(email, label && label.length < 200 ? label : null);
  }
  return null;
}

export function insertionAnchor(host: MailHost, body: HTMLElement) {
  for (const selector of CONFIG[host].insertBefore) {
    const el = body.querySelector(selector);
    if (el) {
      // Climb to the direct child of the body so the link lands between blocks
      let node: Element = el;
      while (node.parentElement && node.parentElement !== body) node = node.parentElement;
      return node;
    }
  }
  return null;
}

// Mail apps shorten long names ("Proposition commerci…2026.pdf") or hide the extension
export function sameFileName(shown: string, fileName: string) {
  const text = shown.trim().toLowerCase();
  const name = fileName.trim().toLowerCase();
  if (!text) return false;
  if (text === name || text === name.replace(/\.pdf$/, "")) return true;
  const [head, tail] = text.split(/…|\.\.\./);
  return tail !== undefined && head.length >= 3 && name.startsWith(head) && name.endsWith(tail);
}

// The attachment chip showing this file name, and its remove control
export function findAttachmentRemover(root: HTMLElement, body: HTMLElement, fileName: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const parent = text.parentElement;
    if (!parent || body.contains(parent) || !sameFileName(text.textContent ?? "", fileName)) continue;

    let chip: HTMLElement | null = parent;
    for (let i = 0; chip && chip !== root && i < 6; i++, chip = chip.parentElement) {
      const remover = Array.from(chip.querySelectorAll<HTMLElement>('[role="button"], button')).find((button) =>
        REMOVE_LABEL.test(`${button.getAttribute("aria-label") ?? ""} ${button.getAttribute("data-tooltip") ?? ""} ${button.title}`),
      );
      if (remover) return remover;
    }
  }
  return null;
}
