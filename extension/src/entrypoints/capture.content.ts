import { defineContentScript } from "wxt/utils/define-content-script";

import { CAPTURE_NONCE_ATTR, CAPTURE_SOURCE } from "@/lib/messages";
import { MAIL_MATCHES } from "@/lib/hosts";
import { looksLikePdf } from "@/lib/pdf";

// Runs in the page itself, before Gmail / Outlook load. Mail apps attach files
// through a hidden <input type=file> they create and click, often detached from
// the DOM, so only a hook on click() sees it. Drag and drop and paste are seen
// by the isolated script. Never blocks or changes what the mail app does.
export default defineContentScript({
  matches: MAIL_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  main() {
    const watched = new WeakSet<HTMLInputElement>();

    const watch = (input: HTMLInputElement) => {
      if (input.type !== "file" || watched.has(input)) return;
      watched.add(input);
      input.addEventListener("change", () => {
        try {
          const files = Array.from(input.files ?? []).filter(looksLikePdf);
          const nonce = document.documentElement.getAttribute(CAPTURE_NONCE_ATTR);
          if (files.length && nonce) {
            window.postMessage({ source: CAPTURE_SOURCE, nonce, files }, location.origin);
          }
        } catch {
          // never break the mail app
        }
      });
    };

    const originalClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      try {
        watch(this);
      } catch {
        // ignore
      }
      return originalClick.call(this);
    };

    // Inputs in the DOM that are opened through a <label> rather than click()
    document.addEventListener(
      "click",
      (event) => {
        const input = event.target instanceof Element && event.target.closest("label")?.control;
        if (input instanceof HTMLInputElement) watch(input);
      },
      true,
    );
  },
});
