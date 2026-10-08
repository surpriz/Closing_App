import type { MailAlert } from "@/lib/pulse";

import { h } from "./dom";
import { getLayer } from "./widget";

export type BannerHandlers = {
  open: (alert: MailAlert) => void;
  later: (alert: MailAlert) => void;
  close: (alert: MailAlert) => void;
};

let stack: HTMLElement | null = null;

/** Replaces the banners on screen with these (newest first). */
export function renderBanners(alerts: MailAlert[], handlers: BannerHandlers) {
  if (!stack?.isConnected) {
    stack = h("div", { class: "banners", role: "region", "aria-label": "Alertes Clozer" });
    getLayer().append(stack);
  }
  stack.replaceChildren(
    ...alerts.map((alert) => {
      const action = alert.priority === "ACTION";
      return h(
        "div",
        { class: action ? "banner action" : "banner", role: "status" },
        h("span", { class: "dot", "aria-hidden": "true" }),
        h("div", { class: "text" }, h("p", { class: "title" }, alert.title), h("p", { class: "muted" }, alert.body)),
        h("button", { class: "close", type: "button", "aria-label": "Fermer", onclick: () => handlers.close(alert) }, "×"),
        h(
          "div",
          { class: "row" },
          h("button", { class: "primary", type: "button", onclick: () => handlers.open(alert) }, action ? "Voir le deal" : "Voir la lecture"),
          action ? null : h("button", { class: "ghost", type: "button", onclick: () => handlers.later(alert) }, "Plus tard"),
        ),
      );
    }),
  );
}
