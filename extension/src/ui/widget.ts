import type { DocumentSummary } from "@/lib/messages";

import { h } from "./dom";
import { STYLES } from "./styles";

let host: HTMLElement | null = null;
let layer: HTMLElement | null = null;

function getLayer() {
  if (host?.isConnected && layer) return layer;
  host = document.createElement("clozer-root");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(h("style", {}, STYLES));
  layer = h("div", { class: "layer" });
  shadow.append(layer);
  document.documentElement.append(host);
  return layer;
}

// When the extension is reloaded or updated, its old UI must leave the page
export function removeLayer() {
  host?.remove();
  host = layer = null;
}

type Action = { label: string; run: () => void; primary?: boolean };

export type PickerHandlers = {
  load: (q: string) => Promise<DocumentSummary[]>;
  pickDocument: (document: DocumentSummary) => void;
  pickFile: (file: File) => void;
};

// One per open compose: a small Clozer button in the corner of the message body,
// and a panel above it for offers, progress and the document picker
export class ComposeWidget {
  private readonly box = h("div", { class: "compose" });
  private readonly panel = h("div", { class: "panel", hidden: true, role: "dialog", "aria-label": "Clozer" });
  private readonly live = h("div", { class: "live", role: "status", "aria-live": "polite" });
  private lastPlace = "";
  private kind: "message" | "picker" | null = null;
  private version = 0;

  constructor(onButton: () => void) {
    const fab = h("button", { class: "fab", type: "button", title: "Insérer un lien Clozer", "aria-label": "Insérer un lien Clozer", onclick: onButton }, "C");
    this.box.append(this.panel, this.live, fab);
    this.box.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.hide();
    });
    getLayer().append(this.box);
  }

  // Bottom-right corner of the message body, hidden when it scrolls out of view
  place(rect: DOMRect) {
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    const top = Math.min(rect.bottom, window.innerHeight) - 36;
    // Not enough room above the button: open the panel below it
    const below = top < 320;
    const key = visible ? `${rect.right}|${top}|${below}` : "hidden";
    if (key === this.lastPlace) return;
    this.lastPlace = key;

    this.box.style.display = visible ? "" : "none";
    this.box.style.left = `${rect.right - 36}px`;
    this.box.style.top = `${top}px`;
    this.box.style.width = "28px";
    this.box.style.height = "28px";
    this.panel.classList.toggle("below", below);
  }

  get showingPicker() {
    return this.kind === "picker";
  }

  get idle() {
    return this.kind === null;
  }

  hide() {
    this.kind = null;
    this.version++;
    this.panel.hidden = true;
    this.panel.replaceChildren();
  }

  // Hides the current content later, unless something else replaced it meanwhile
  hideAfter(ms: number) {
    const version = this.version;
    setTimeout(() => version === this.version && this.hide(), ms);
  }

  destroy() {
    this.box.remove();
  }

  private show(...children: (Node | null)[]) {
    this.kind = "message";
    this.version++;
    this.panel.replaceChildren(...children.filter((c): c is Node => c !== null));
    this.panel.hidden = false;
  }

  private actions(actions: Action[]) {
    return h(
      "div",
      { class: "row" },
      ...actions.map((a) => h("button", { type: "button", class: a.primary ? "primary" : "ghost", onclick: a.run }, a.label)),
    );
  }

  message(title: string, text: string | null, actions: Action[] = []) {
    this.live.textContent = text ? `${title}. ${text}` : title;
    this.show(h("p", { class: "title" }, title), text ? h("p", { class: "muted" }, text) : null, actions.length ? this.actions(actions) : null);
  }

  error(text: string, actions: Action[] = []) {
    this.show(h("p", { class: "error", role: "alert" }, text), this.actions([...actions, { label: "Fermer", run: () => this.hide() }]));
  }

  progress(title: string, percent: number | null) {
    const bar = h("div", { class: "bar" }, h("span", { style: `width: ${percent ?? 15}%` }));
    this.show(h("p", { class: "title", role: "status" }, title), bar);
  }

  picker(handlers: PickerHandlers) {
    const list = h("ul");
    const search = h("input", { class: "search", type: "search", placeholder: "Rechercher un document", "aria-label": "Rechercher un document" });
    const file = h("input", { type: "file", accept: "application/pdf,.pdf", hidden: true });
    file.addEventListener("change", () => {
      const picked = file.files?.[0];
      if (picked) handlers.pickFile(picked);
    });

    let seq = 0;
    const refresh = async () => {
      const current = ++seq;
      list.replaceChildren(h("li", {}, h("p", { class: "muted" }, "Chargement…")));
      try {
        const documents = await handlers.load(search.value.trim());
        if (current !== seq) return;
        list.replaceChildren(
          ...(documents.length
            ? documents.map((doc) => h("li", {}, h("button", { type: "button", onclick: () => handlers.pickDocument(doc) }, doc.name)))
            : [h("li", {}, h("p", { class: "muted" }, "Aucun document. Ajoutez un PDF."))]),
        );
      } catch (error) {
        if (current === seq) list.replaceChildren(h("li", {}, h("p", { class: "error" }, (error as Error).message)));
      }
    };
    let timer: ReturnType<typeof setTimeout>;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    });

    this.show(
      h("p", { class: "title" }, "Insérer un document"),
      this.actions([
        { label: "Ajouter un PDF…", run: () => file.click(), primary: true },
        { label: "Fermer", run: () => this.hide() },
      ]),
      file,
      search,
      list,
    );
    this.kind = "picker";
    void refresh();
    search.focus();
  }
}
