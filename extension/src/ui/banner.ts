import type { MailAlert } from "@/lib/pulse";
import { COPY } from "@/lib/copy";

import { h } from "./dom";
import { closeIcon, logoMark } from "./marks";
import { getLayer } from "./widget";

export type BannerHandlers = {
  open: (alert: MailAlert) => void;
  later: (alert: MailAlert) => void;
  close: (alert: MailAlert) => void;
  won: (alert: MailAlert) => void;
};

let stack: HTMLElement | null = null;

function getStack() {
  if (!stack?.isConnected) {
    stack = h("div", { class: "banners", role: "region", "aria-label": "Alertes Clozer" });
    getLayer().append(stack);
  }
  return stack;
}

/** The app no longer accepts this version: one banner that stays until the update is done. */
export function renderUpdateBanner(update: () => Promise<string>) {
  const text = h("p", { class: "muted" }, COPY.updateText);
  const button = h(
    "button",
    {
      class: "primary",
      type: "button",
      onclick: async () => {
        button.disabled = true;
        text.textContent = await update();
        button.disabled = false;
      },
    },
    COPY.update,
  );
  getStack().replaceChildren(
    h(
      "div",
      { class: "banner action", role: "status" },
      h("span", { class: "mark" }, logoMark(18)),
      h("div", { class: "text" }, h("p", { class: "title" }, COPY.updateTitle), text),
      h("div", { class: "row" }, button),
    ),
  );
}

/** Replaces the banners on screen with these (newest first). */
export function renderBanners(alerts: MailAlert[], handlers: BannerHandlers) {
  getStack().replaceChildren(
    ...alerts.map((alert) => {
      const action = alert.priority === "ACTION";
      return h(
        "div",
        { class: action ? "banner action" : "banner", role: "status" },
        h("span", { class: "mark" }, logoMark(18)),
        h(
          "div",
          { class: "text" },
          h("p", { class: "title" }, h("span", { class: "dot", "aria-hidden": "true" }), alert.title),
          h("p", { class: "muted" }, alert.body),
        ),
        h("button", { class: "close", type: "button", "aria-label": COPY.close, title: COPY.close, onclick: () => handlers.close(alert) }, closeIcon()),
        h(
          "div",
          { class: "row" },
          alert.canMarkWon
            ? h("button", { class: "primary", type: "button", onclick: () => handlers.won(alert) }, "Marquer gagné")
            : null,
          h(
            "button",
            { class: alert.canMarkWon ? "ghost" : "primary", type: "button", onclick: () => handlers.open(alert) },
            action ? "Voir le deal" : "Voir la lecture",
          ),
          action ? null : h("button", { class: "ghost", type: "button", onclick: () => handlers.later(alert) }, "Plus tard"),
        ),
      );
    }),
  );
}
