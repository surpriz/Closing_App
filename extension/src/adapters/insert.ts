import { linkHtml } from "@/lib/link-html";
import type { LinkStyle } from "@/lib/preferences";

// The block of the body that holds this node (a line in Gmail and Outlook)
function lineOf(body: HTMLElement, node: Node) {
  let current: Node | null = node;
  while (current && current.parentNode !== body) current = current.parentNode;
  return current;
}

// Inserts through the editor's own input pipeline (execCommand), so Gmail and
// Outlook save the draft and keep undo working. False when the editor refused.
export function insertLink(
  body: HTMLElement,
  saved: Range | null,
  anchor: Element | null,
  link: { url: string; title: string; style: LinkStyle },
) {
  body.focus();
  const selection = window.getSelection();
  if (!selection) return false;

  let line = saved && body.contains(saved.startContainer) ? lineOf(body, saved.startContainer) : null;
  // Caret in the signature or the quoted message: the link still goes above them
  if (line && anchor && (line === anchor || anchor.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING)) {
    line = null;
  }

  const range = document.createRange();
  if (saved && line && !line.textContent?.trim()) {
    // Caret on an empty line: the link takes that line
    range.setStart(saved.startContainer, saved.startOffset);
    range.setEnd(saved.endContainer, saved.endOffset);
  } else if (line) {
    // Caret in a sentence: the link goes on its own line right after it
    range.setStartAfter(line);
    range.collapse(true);
  } else if (anchor) {
    range.setStartBefore(anchor);
    range.collapse(true);
  } else {
    range.selectNodeContents(body);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);

  return document.execCommand("insertHTML", false, linkHtml(link.url, link.title, link.style));
}
