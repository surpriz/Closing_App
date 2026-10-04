import { browser } from "wxt/browser";

import { API_ORIGIN } from "@/lib/config";
import { ask, type Account } from "@/lib/messages";
import { h } from "@/ui/dom";

const app = document.getElementById("app")!;

function render(...children: (Node | string | null)[]) {
  app.replaceChildren(h("h1", {}, "Clozer"), ...children.filter((c): c is Node | string => c !== null));
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

  render(
    h("p", {}, `Connecté : ${account.user.email}`),
    h("p", { class: "muted" }, `Espace ${account.organization.name}`),
    h(
      "div",
      { class: "row" },
      h("button", { class: "primary", onclick: () => void browser.tabs.create({ url: `${API_ORIGIN}/dashboard` }) }, "Ouvrir Clozer"),
      h("button", { onclick: () => void ask({ type: "disconnect" }).then(show) }, "Déconnecter"),
    ),
  );
}

void show();
