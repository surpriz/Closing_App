import type { LinkStyle } from "@ext/link-html";
import { alertsToShow, readerLine, rememberSeen, type Pulse, type PulseAlert, type PulseReader } from "@ext/pulse";
import { h } from "@extui/dom";

import { api, type Account, type DocumentSummary } from "../lib/api";
import { isPdfAttachment, parseContext, type AttachmentInfo } from "../lib/compose";
import { APP_ORIGIN, KILL_SWITCH_HOST } from "../lib/config";
import { ensureDocument, searchDocuments } from "../lib/documents";
import { ClozerError } from "../lib/errors";
import { insertDocument, insertedNote, NOTICE_KEY, replaceAttachment } from "../lib/insert";
import { composeItem, mailbox, officeCall, openInBrowser, supports } from "../lib/office";
import { CONNECT_URL, startPairing, waitForPairing, type Pairing } from "../lib/pairing";
import { getAskFirst, getLinkStyle, getToken, setAskFirst, setLinkStyle, setToken } from "../lib/settings";

const PULSE_MS = 30_000;
const SEEN_KEY = "clozerSeenAlerts";

type Status = { kind: "progress" | "done" | "error"; title: string; detail?: string };

const state = {
  account: null as Account | null,
  pairing: null as Pairing | null,
  pairingError: null as string | null,
  status: null as Status | null,
  busy: false,
  attachments: [] as AttachmentInfo[],
  query: "",
  documents: null as DocumentSummary[] | null,
  readers: [] as PulseReader[],
  alerts: [] as PulseAlert[],
  since: null as string | null,
};

const app = document.getElementById("app")!;

// ---------------------------------------------------------------------------
// Rendering

function render() {
  const nodes = !getToken() ? connectView() : mainView();
  app.replaceChildren(h("h1", {}, "Clozer"), ...nodes.filter((node): node is Node => node !== null));
}

function statusView() {
  const status = state.status;
  if (!status) return null;
  return h(
    "div",
    { class: `status${status.kind === "error" ? " error" : ""}`, role: status.kind === "error" ? "alert" : "status" },
    h("strong", {}, status.title),
    status.detail ? h("span", { class: "small" }, status.detail) : null,
  );
}

function connectView(): (Node | null)[] {
  if (state.pairing) {
    const pairing = state.pairing;
    return [
      h("p", {}, "Dans votre navigateur, connecté à Clozer, saisissez ce code :"),
      h("div", { class: "code", "aria-label": `Code ${pairing.code.split("").join(" ")}` }, pairing.code),
      h(
        "div",
        { class: "row" },
        h("button", { class: "primary", onclick: () => openInBrowser(CONNECT_URL) }, "Ouvrir Clozer"),
        h("button", { onclick: () => cancelPairing() }, "Annuler"),
      ),
      h("p", { class: "muted small" }, "Cette fenêtre se met à jour toute seule une fois le code validé."),
    ];
  }
  return [
    h("p", {}, "Remplacez le PDF joint à un email par un lien Clozer, et voyez qui consulte vos propositions."),
    state.pairingError ? h("p", { class: "error", role: "alert" }, state.pairingError) : null,
    h("button", { class: "primary", onclick: () => void connect() }, "Connecter Clozer"),
  ];
}

function mainView(): (Node | null)[] {
  const account = state.account;
  if (account?.disabledHosts.includes(KILL_SWITCH_HOST)) {
    return [h("p", { class: "muted" }, "Clozer est momentanément indisponible dans Outlook. Réessayez plus tard."), footer()];
  }
  const compose = composeItem();
  return [
    statusView(),
    compose ? attachmentsView(compose) : null,
    compose ? documentsView(compose) : null,
    compose ? linkStyleView() : null,
    compose ? askFirstView() : null,
    alertsView(),
    readersView(),
    footer(),
  ];
}

function attachmentsView(compose: Office.MessageCompose) {
  if (!supports("1.8")) return null;
  const pdfs = state.attachments.filter(isPdfAttachment);
  if (!pdfs.length) {
    return h("p", { class: "muted" }, "Joignez un PDF à cet email : Clozer le remplacera par un lien.");
  }
  return h(
    "fieldset",
    {},
    h("legend", {}, "PDF joints"),
    ...pdfs.map((attachment) =>
      h(
        "div",
        { class: "item" },
        h("span", { title: attachment.name }, attachment.name),
        h(
          "button",
          { class: "primary", disabled: state.busy, onclick: () => void replaceInPane(compose, attachment) },
          "Remplacer par un lien",
        ),
      ),
    ),
  );
}

function documentsView(compose: Office.MessageCompose) {
  const fileInput = h("input", {
    type: "file",
    accept: "application/pdf,.pdf",
    hidden: true,
    onchange: (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) void insertFile(compose, file);
    },
  });
  const list = state.documents;
  return h(
    "fieldset",
    {},
    h("legend", {}, "Insérer un document Clozer"),
    h("input", {
      type: "search",
      placeholder: "Rechercher un document…",
      value: state.query,
      "aria-label": "Rechercher un document",
      oninput: (event: Event) => void search((event.target as HTMLInputElement).value),
      onfocus: () => {
        if (!state.documents) void search(state.query);
      },
    }),
    list && !list.length ? h("p", { class: "muted small" }, "Aucun document trouvé.") : null,
    ...(list ?? []).map((doc) =>
      h("button", { class: "pick", title: doc.name, disabled: state.busy, onclick: () => void insertExisting(compose, doc) }, doc.name),
    ),
    fileInput,
    h("button", { class: "link", disabled: state.busy, onclick: () => fileInput.click() }, "Ajouter un PDF depuis l'ordinateur…"),
  );
}

const STYLES: { value: LinkStyle; label: string }[] = [
  { value: "card", label: "Carte avec le titre" },
  { value: "text", label: "Lien simple" },
];

function linkStyleView() {
  const current = getLinkStyle();
  return h(
    "fieldset",
    {},
    h("legend", {}, "Format du lien"),
    ...STYLES.map((style) =>
      h(
        "label",
        { class: "choice" },
        h("input", {
          type: "radio",
          name: "linkStyle",
          value: style.value,
          checked: style.value === current,
          onchange: () => void setLinkStyle(style.value).catch(() => undefined),
        }),
        h("span", {}, style.label),
      ),
    ),
  );
}

// Default: an attached PDF becomes a link on its own. Some sellers want to choose each time.
function askFirstView() {
  const askFirst = getAskFirst();
  const choices = [
    { value: false, label: "Le remplacer tout de suite" },
    { value: true, label: "Me demander d'abord" },
  ];
  return h(
    "fieldset",
    {},
    h("legend", {}, "Quand je joins un PDF"),
    ...choices.map((choice) =>
      h(
        "label",
        { class: "choice" },
        h("input", {
          type: "radio",
          name: "askFirst",
          checked: choice.value === askFirst,
          onchange: () => void setAskFirst(choice.value).catch(() => undefined),
        }),
        h("span", {}, choice.label),
      ),
    ),
  );
}

function alertsView() {
  if (!state.alerts.length) return null;
  return h(
    "div",
    { class: "row", style: "display:grid" },
    ...state.alerts.map((alert) =>
      h(
        "div",
        { class: "alert", role: "status" },
        h("strong", {}, alert.title),
        h("span", { class: "small" }, alert.body),
        h(
          "div",
          { class: "row" },
          h("button", { onclick: () => openInBrowser(alert.url) }, "Ouvrir"),
          h("button", { class: "link", onclick: () => dismissAlert(alert.id) }, "OK"),
        ),
      ),
    ),
  );
}

function readersView() {
  if (!state.readers.length) return h("p", { class: "muted small" }, "Personne ne lit vos propositions en ce moment.");
  return h(
    "fieldset",
    {},
    h("legend", {}, "En train de lire"),
    ...state.readers.map((reader) =>
      h(
        "button",
        { class: "reader", onclick: () => openInBrowser(`${APP_ORIGIN}/links/${reader.linkId}`) },
        h("span", { class: "dot" }),
        readerLine(reader),
      ),
    ),
  );
}

function footer() {
  return h(
    "div",
    { class: "row" },
    state.account ? h("span", { class: "muted small" }, state.account.user.email) : null,
    h("button", { class: "link", onclick: () => void disconnect() }, "Déconnecter"),
  );
}

// ---------------------------------------------------------------------------
// Account and pairing

let pairingAbort: AbortController | null = null;

async function connect() {
  state.pairingError = null;
  pairingAbort = new AbortController();
  try {
    state.pairing = await startPairing();
    render();
    openInBrowser(CONNECT_URL);
    await waitForPairing(state.pairing, { signal: pairingAbort.signal });
    state.pairing = null;
    await loadAccount();
    startPulse();
    await refreshAttachments();
  } catch (error) {
    state.pairing = null;
    if (!(error instanceof ClozerError && error.code === "aborted")) state.pairingError = messageOf(error);
  }
  render();
}

function cancelPairing() {
  pairingAbort?.abort();
  state.pairing = null;
  render();
}

async function loadAccount() {
  state.account = await api<Account>("/api/ext/me").catch((error: unknown) => {
    if (error instanceof ClozerError && error.code === "unauthorized") return null;
    return state.account;
  });
}

async function disconnect() {
  await api("/api/ext/token", { method: "DELETE" }).catch(() => undefined);
  await setToken(null).catch(() => undefined);
  state.account = null;
  state.readers = [];
  state.alerts = [];
  stopPulse();
  render();
}

// ---------------------------------------------------------------------------
// Inserting links

function setStatus(status: Status | null) {
  state.status = status;
  render();
}

function messageOf(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Une erreur est survenue.";
}

async function run(task: () => Promise<void>) {
  if (state.busy) return;
  state.busy = true;
  try {
    await task();
  } catch (error) {
    setStatus({ kind: "error", title: "Lien non créé", detail: messageOf(error) });
  } finally {
    state.busy = false;
    render();
  }
}

function step(title: string) {
  setStatus({ kind: "progress", title });
}

async function replaceInPane(compose: Compose, attachment: AttachmentInfo) {
  await run(async () => done(await replaceAttachment(compose, attachment, step)));
}

async function insertFile(compose: Compose, file: File) {
  await run(async () => {
    step("Préparation du PDF…");
    const document = await ensureDocument(new Uint8Array(await file.arrayBuffer()), file.name, (percent) =>
      step(`Envoi du PDF… ${percent} %`),
    );
    done(await insertDocument(compose, document, step));
  });
}

async function insertExisting(compose: Compose, document: DocumentSummary) {
  await run(async () => done(await insertDocument(compose, document, step)));
}

type Compose = Office.MessageCompose;

function done(result: Awaited<ReturnType<typeof insertDocument>>) {
  const compose = composeItem();
  if (compose) void officeCall<void>((callback) => compose.notificationMessages.removeAsync(NOTICE_KEY, callback)).catch(() => undefined);
  void refreshAttachments().then(render);
  setStatus({ kind: "done", title: "Lien inséré", detail: insertedNote(result) });
}

let searchToken = 0;

async function search(query: string) {
  state.query = query;
  const mine = ++searchToken;
  const documents = await searchDocuments(query.trim()).catch(() => []);
  if (mine !== searchToken) return;
  state.documents = documents;
  // Keep the caret in the search field across the re-render
  const focused = document.activeElement instanceof HTMLInputElement && document.activeElement.type === "search";
  render();
  if (focused) {
    const input = app.querySelector<HTMLInputElement>('input[type="search"]');
    input?.focus();
    input?.setSelectionRange(query.length, query.length);
  }
}

async function refreshAttachments() {
  const compose = composeItem();
  if (!compose || !supports("1.8")) {
    state.attachments = [];
    return;
  }
  state.attachments = await officeCall<Office.AttachmentDetailsCompose[]>((callback) => compose.getAttachmentsAsync(callback))
    .then((list) => list.map((a) => ({ id: a.id, name: a.name, attachmentType: a.attachmentType, isInline: a.isInline })))
    .catch(() => []);
}

// Opened from the "Replace" action of the attachment notice: do it right away
async function replaceFromNotice() {
  const compose = composeItem();
  if (!compose || !supports("1.8") || !getToken()) return;
  const context = await officeCall<string>((callback) => compose.getInitializationContextAsync(callback)).catch(() => null);
  const { attachmentId } = parseContext(context);
  const attachment = attachmentId ? state.attachments.find((a) => a.id === attachmentId) : null;
  if (attachment && isPdfAttachment(attachment)) await replaceInPane(compose, attachment);
}

// ---------------------------------------------------------------------------
// Who is reading, alerts. Only while the pane is open (pin it to keep it).

let pulseTimer: ReturnType<typeof setInterval> | null = null;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeSeen(seen: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // private mode: alerts may show again, nothing worse
  }
}

function dismissAlert(id: string) {
  writeSeen(rememberSeen(readSeen(), [id]));
  state.alerts = state.alerts.filter((alert) => alert.id !== id);
  render();
}

async function pulse() {
  if (!getToken() || document.visibilityState === "hidden") return;
  const query = state.since ? `?since=${encodeURIComponent(state.since)}` : "";
  const data = await api<Pulse>(`/api/ext/pulse${query}`).catch(() => null);
  if (!data) return;
  state.since = data.next;
  state.readers = data.enabled ? data.readers : [];
  const fresh = alertsToShow(data.alerts, { seen: readSeen(), snoozed: {}, callMoments: true }, Date.now());
  const known = new Set(state.alerts.map((alert) => alert.id));
  state.alerts = [...fresh.filter((alert) => !known.has(alert.id)).reverse(), ...state.alerts].slice(0, 5);
  if (!state.busy) render();
}

function startPulse() {
  stopPulse();
  void pulse();
  pulseTimer = setInterval(() => void pulse(), PULSE_MS);
}

function stopPulse() {
  if (pulseTimer) clearInterval(pulseTimer);
  pulseTimer = null;
}

// ---------------------------------------------------------------------------

async function onItemChanged() {
  state.status = null;
  state.documents = null;
  state.query = "";
  await refreshAttachments();
  render();
}

void Office.onReady(async () => {
  if (getToken()) {
    await loadAccount();
    startPulse();
  }
  await refreshAttachments();
  render();

  const compose = composeItem();
  if (compose && supports("1.8")) {
    compose.addHandlerAsync(Office.EventType.AttachmentsChanged, () => void refreshAttachments().then(render));
  }
  // A pinned pane follows the selected email
  if (supports("1.5")) mailbox().addHandlerAsync(Office.EventType.ItemChanged, () => void onItemChanged());
  document.addEventListener("visibilitychange", () => void pulse());

  await replaceFromNotice();
});
