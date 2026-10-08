import { browser } from "wxt/browser";

import { API_ORIGIN } from "@/lib/config";
import { ask, type Account } from "@/lib/messages";
import { getLinkStyle, setLinkStyle, type LinkStyle } from "@/lib/preferences";
import { readerLine, type PulseReader } from "@/lib/pulse";
import { h } from "@/ui/dom";

const app = document.getElementById("app")!;

function render(...children: (Node | string | null)[]) {
  app.replaceChildren(h("h1", {}, "Clozer"), ...children.filter((c): c is Node | string => c !== null));
}

const STYLES: { value: LinkStyle; label: string; hint: string }[] = [
  { value: "card", label: "Carte", hint: "Un encadré avec le titre et « Consulter le document »" },
  { value: "text", label: "Lien simple", hint: "Une ligne soulignée, plus discrète" },
];

// Applies to the next links inserted from this browser
async function linkStyleField() {
  const current = await getLinkStyle();
  return h(
    "fieldset",
    {},
    h("legend", {}, "Format du lien dans l'email"),
    ...STYLES.map((style) =>
      h(
        "label",
        { class: "choice" },
        h("input", {
          type: "radio",
          name: "linkStyle",
          value: style.value,
          checked: style.value === current,
          onchange: () => void setLinkStyle(style.value),
        }),
        h("span", {}, h("strong", {}, style.label), h("span", { class: "muted" }, style.hint)),
      ),
    ),
  );
}

// Who reads the seller's proposals right now (last pulse, at most 30 s old)
async function readingNow() {
  const readers = await ask<PulseReader[]>({ type: "readers" }).catch(() => []);
  if (!readers.length) return h("p", { class: "muted" }, "Personne ne lit vos propositions en ce moment.");
  return h(
    "fieldset",
    {},
    h("legend", {}, "En train de lire"),
    ...readers.map((reader) =>
      h(
        "button",
        { class: "reader", onclick: () => void browser.tabs.create({ url: `${API_ORIGIN}/links/${reader.linkId}` }) },
        h("span", { class: "dot" }),
        readerLine(reader),
      ),
    ),
  );
}

async function callMomentsField() {
  const enabled = await ask<boolean>({ type: "callMoments" }).catch(() => true);
  return h(
    "label",
    { class: "choice" },
    h("input", {
      type: "checkbox",
      checked: enabled,
      onchange: (event: Event) => void ask({ type: "callMoments", enabled: (event.target as HTMLInputElement).checked }),
    }),
    h(
      "span",
      {},
      h("strong", {}, "Me prévenir quand c'est le moment d'appeler"),
      h("span", { class: "muted" }, "Première ouverture, retour après un silence, tarifs, lecture à plusieurs"),
      h(
        "button",
        { class: "link", type: "button", onclick: () => void ask({ type: "testNotification" }) },
        "Tester la notification",
      ),
    ),
  );
}

async function show() {
  render(h("p", { class: "muted" }, "Chargement…"));
  let account: Account | null = null;
  let error: string | null = null;
  try {
    account = await ask<Account | null>({ type: "account" });
  } catch (e) {
    error = (e as Error).message;
  }

  if (!account) {
    render(
      h("p", {}, "Joignez un PDF dans Gmail ou Outlook : Clozer le remplace par un lien en un clic."),
      error ? h("p", { class: "error" }, error) : null,
      h(
        "div",
        { class: "row" },
        h("button", { class: "primary", onclick: () => void ask({ type: "connect" }).then(() => window.close()) }, "Connecter"),
      ),
    );
    return;
  }

  const notifications = account.notificationsEnabled !== false;
  render(
    h("p", {}, `Connecté : ${account.user.email}`),
    h("p", { class: "muted" }, `Espace ${account.organization.name}`),
    notifications ? await readingNow() : null,
    notifications ? await callMomentsField() : null,
    await linkStyleField(),
    h(
      "div",
      { class: "row" },
      h("button", { class: "primary", onclick: () => void browser.tabs.create({ url: `${API_ORIGIN}/dashboard` }) }, "Ouvrir Clozer"),
      h("button", { class: "ghost", onclick: () => void ask({ type: "disconnect" }).then(show) }, "Déconnecter"),
    ),
  );
}

void show();
