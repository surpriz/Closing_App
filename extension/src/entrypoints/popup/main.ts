import { browser } from "wxt/browser";

import { API_ORIGIN } from "@/lib/config";
import { COPY, getLocale } from "@/lib/copy";
import { mailHost } from "@/lib/hosts";
import { ask, requestUpdate, type Account } from "@/lib/messages";
import { getAskFirst, getLinkStyle, setAskFirst, setLinkStyle, type LinkStyle } from "@/lib/preferences";
import type { PulseReader } from "@/lib/pulse";
import { isOlder } from "@/lib/version";
import { h } from "@/ui/dom";
import { logo } from "@/ui/marks";
import { readerRows } from "@/ui/readers";

document.documentElement.lang = getLocale();
const app = document.getElementById("app")!;

// Report header strip (logo, workspace) above an ink rule, then the sheet
function render(workspace: string | null, ...children: (Node | string | null)[]) {
  app.replaceChildren(
    h("header", { class: "strip" }, h("h1", {}, logo(20)), workspace ? h("span", { class: "workspace", title: workspace }, workspace) : null),
    h("div", { class: "sheet" }, ...children.filter((c): c is Node | string => c !== null)),
  );
}

const STYLES: { value: LinkStyle; label: string; hint: string }[] = [
  { value: "card", label: COPY.card, hint: COPY.cardHint },
  { value: "text", label: COPY.plainLink, hint: COPY.plainLinkHint },
];

async function linkStyleField() {
  const current = await getLinkStyle();
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.linkStyleLegend),
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

async function askFirstField() {
  const current = await getAskFirst();
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.askFirstLegend),
    ...[
      { value: false, label: COPY.replaceWithLink, hint: COPY.replaceWithLinkHint },
      { value: true, label: COPY.askFirst, hint: COPY.askFirstHint },
    ].map((choice) =>
      h(
        "label",
        { class: "choice" },
        h("input", {
          type: "radio",
          name: "askFirst",
          checked: choice.value === current,
          onchange: () => void setAskFirst(choice.value),
        }),
        h("span", {}, h("strong", {}, choice.label), h("span", { class: "muted" }, choice.hint)),
      ),
    ),
  );
}

async function readingNow() {
  const readers = await ask<PulseReader[]>({ type: "readers" }).catch(() => []);
  if (!readers.length) return h("p", { class: "muted" }, COPY.nobodyReading);
  return h(
    "section",
    { class: "readings-block" },
    h("h2", {}, COPY.readingNow),
    readerRows(readers, (reader) => void browser.tabs.create({ url: `${API_ORIGIN}/links/${reader.linkId}` })),
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
      h("strong", {}, COPY.callMoments),
      h("span", { class: "muted" }, COPY.callMomentsHint),
      h("button", { class: "link", type: "button", onclick: () => void ask({ type: "testNotification" }) }, COPY.testNotification),
    ),
  );
}

// "Déconnecter" asks once, in place: no dialog, no second screen
function disconnectField() {
  const row = h("div", { class: "row" });
  const askButton = h("button", { class: "ghost", type: "button", onclick: () => confirm() }, COPY.disconnect);
  const confirm = () =>
    row.replaceChildren(
      h("p", {}, COPY.disconnectConfirm),
      h("button", { class: "primary", type: "button", onclick: () => void ask({ type: "disconnect" }).then(show) }, COPY.disconnect),
      h("button", { class: "ghost", type: "button", onclick: () => row.replaceChildren(askButton) }, COPY.cancel),
    );
  row.append(askButton);
  return row;
}

// The mail tab in front, when the app switched Clozer off there: the seller sees why nothing happens
async function pausedOn(account: Account) {
  if (!account.disabledHosts.length) return null;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const host = tab?.url ? mailHost(new URL(tab.url).hostname) : null;
  if (!host || !account.disabledHosts.includes(host)) return null;
  return h("p", { class: "muted" }, COPY.paused(host === "gmail" ? "Gmail" : "Outlook"));
}

async function show() {
  render(null, h("p", { class: "muted" }, COPY.loading));
  let account: Account | null = null;
  let error: string | null = null;
  try {
    account = await ask<Account | null>({ type: "account" });
  } catch (e) {
    error = (e as Error).message;
  }

  if (!account) {
    render(
      null,
      h("p", {}, COPY.pitch),
      error ? h("p", { class: "error" }, error) : null,
      h(
        "div",
        { class: "row" },
        h("button", { class: "primary wide", onclick: () => void ask({ type: "connect" }).then(() => window.close()) }, COPY.connect),
      ),
    );
    return;
  }

  if (account.minVersion && isOlder(browser.runtime.getManifest().version, account.minVersion)) {
    const text = h("p", { class: "muted" }, COPY.updateText);
    const button = h(
      "button",
      {
        class: "primary wide",
        onclick: async () => {
          button.disabled = true;
          text.textContent = await requestUpdate();
          button.disabled = false;
        },
      },
      COPY.update,
    );
    render(COPY.workspace(account.organization.name), h("p", {}, h("strong", {}, COPY.updateTitle)), text, h("div", { class: "row" }, button));
    return;
  }

  const notifications = account.notificationsEnabled !== false;
  render(
    COPY.workspace(account.organization.name),
    await pausedOn(account),
    notifications ? await readingNow() : null,
    h(
      "div",
      { class: "row" },
      h("button", { class: "primary wide", onclick: () => void browser.tabs.create({ url: `${API_ORIGIN}/dashboard` }) }, COPY.openApp),
    ),
    h(
      "details",
      { class: "settings" },
      h("summary", {}, COPY.settings),
      notifications ? await callMomentsField() : null,
      await askFirstField(),
      await linkStyleField(),
      h("p", { class: "muted small" }, COPY.connected(account.user.email)),
      disconnectField(),
    ),
  );
}

void show();
