import type { LinkStyle } from "@ext/link-html";
import { COPY } from "@ext/copy";
import { alertsToShow, rememberSeen, type Pulse, type PulseAlert, type PulseReader } from "@ext/pulse";
import { h } from "@extui/dom";
import { logo } from "@extui/marks";
import { readerRows } from "@extui/readers";

import { api, type Account, type DocumentSummary } from "../lib/api";
import { isPdfAttachment, parseContext, type AttachmentInfo, type InsertedLink } from "../lib/compose";
import { APP_ORIGIN, KILL_SWITCH_HOST } from "../lib/config";
import { ensureDocument, searchDocuments } from "../lib/documents";
import { ClozerError } from "../lib/errors";
import { insertDocument, insertedNote, NOTICE_KEY, replaceAttachment } from "../lib/insert";
import { readLinks } from "../lib/links-store";
import { syncLocale } from "../lib/locale";
import { composeItem, mailbox, officeCall, openInBrowser, supports } from "../lib/office";
import { CONNECT_URL, startPairing, waitForPairing, type Pairing } from "../lib/pairing";
import { getAskFirst, getLinkStyle, getToken, setAskFirst, setLinkStyle, setToken } from "../lib/settings";

const PULSE_MS = 30_000;
const SEEN_KEY = "clozerSeenAlerts";

type Status = { kind: "progress" | "done" | "error"; title: string; detail?: string; action?: { label: string; run: () => void } };

const state = {
  account: null as Account | null,
  pairing: null as Pairing | null,
  pairingError: null as string | null,
  status: null as Status | null,
  busy: false,
  attachments: [] as AttachmentInfo[],
  links: [] as InsertedLink[],
  query: "",
  documents: null as DocumentSummary[] | null,
  readers: [] as PulseReader[],
  alerts: [] as PulseAlert[],
  since: null as string | null,
  settingsOpen: false,
};

const app = document.getElementById("app")!;
// Browser language until Office says otherwise in onReady
syncLocale();
app.replaceChildren(h("p", { class: "muted" }, COPY.loading));

// ---------------------------------------------------------------------------
// Rendering

function render() {
  const nodes = !getToken() ? connectView() : mainView();
  // Report header strip (logo, workspace) above an ink rule, then the sheet
  const workspace = getToken() && state.account ? COPY.workspace(state.account.organization.name) : null;
  app.replaceChildren(
    h("header", { class: "strip" }, h("h1", {}, logo(20)), workspace ? h("span", { class: "workspace", title: workspace }, workspace) : null),
    h("div", { class: "sheet" }, ...nodes.filter((node): node is Node => node !== null)),
  );
}

function statusView() {
  const status = state.status;
  if (!status) return null;
  return h(
    "div",
    { class: `status${status.kind === "error" ? " error" : ""}`, role: status.kind === "error" ? "alert" : "status" },
    h("strong", {}, status.title),
    status.detail ? h("span", { class: "small" }, status.detail) : null,
    status.action ? h("div", { class: "row" }, h("button", { onclick: status.action.run }, status.action.label)) : null,
  );
}

function connectView(): (Node | null)[] {
  if (state.pairing) {
    const pairing = state.pairing;
    return [
      h("p", {}, COPY.enterCode),
      h("div", { class: "code", "aria-label": COPY.codeLabel(pairing.code.split("").join(" ")) }, pairing.code),
      h(
        "div",
        { class: "row" },
        h("button", { class: "primary", onclick: () => openInBrowser(CONNECT_URL) }, COPY.openApp),
        h("button", { onclick: () => cancelPairing() }, COPY.cancel),
      ),
      h("p", { class: "muted small" }, COPY.paneUpdates),
    ];
  }
  return [
    h("p", {}, COPY.pitchOutlook),
    state.pairingError ? h("p", { class: "error", role: "alert" }, state.pairingError) : null,
    h("button", { class: "primary wide", onclick: () => void connect() }, COPY.connect),
  ];
}

function mainView(): (Node | null)[] {
  const account = state.account;
  if (account?.disabledHosts.includes(KILL_SWITCH_HOST)) {
    return [h("p", { class: "muted" }, COPY.paused("Outlook")), settingsView()];
  }
  const compose = composeItem();
  // What to do first, then what happened, then what is going on elsewhere; the settings fold away
  return [
    statusView(),
    compose ? attachmentsView(compose) : null,
    compose ? documentsView(compose) : null,
    compose ? linksView() : null,
    alertsView(),
    readersView(),
    settingsView(),
  ];
}

// The links already in this email, and one click to each one's page in Clozer
function linksView() {
  if (!state.links.length) return null;
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.inThisEmail),
    ...state.links.map((link) => {
      // Only our own pages open from the pane
      const target = link.manageUrl?.startsWith(`${APP_ORIGIN}/`) ? link.manageUrl : link.url;
      return h(
        "div",
        { class: "item" },
        h("span", { title: link.title ?? COPY.clozerLink }, link.title ?? COPY.clozerLink),
        h("button", { class: "link", onclick: () => openInBrowser(target) }, COPY.seeLink),
      );
    }),
  );
}

function attachmentsView(compose: Office.MessageCompose) {
  if (!supports("1.8")) return null;
  const pdfs = state.attachments.filter(isPdfAttachment);
  if (!pdfs.length) {
    return h("p", { class: "muted" }, COPY.pitchHere);
  }
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.attachedPdfs),
    // One ink action per group: the first PDF; the others are outlined
    ...pdfs.map((attachment, index) =>
      h(
        "div",
        { class: "item" },
        h("span", { title: attachment.name }, attachment.name),
        h(
          "button",
          { class: index === 0 ? "primary" : "", disabled: state.busy, onclick: () => void replaceInPane(compose, attachment) },
          COPY.replaceWithLink,
        ),
      ),
    ),
  );
}

// Search results land in this list alone: no re-render, so the caret stays in the field
let refreshList: (() => void) | null = null;

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
  const listHost = h("div", { class: "list" });
  refreshList = () => {
    const list = state.documents;
    listHost.replaceChildren(
      ...(list && !list.length ? [h("p", { class: "muted small" }, COPY.noDocument)] : []),
      ...(list ?? []).map((doc) =>
        h("button", { class: "pick", title: doc.name, disabled: state.busy, onclick: () => void insertExisting(compose, doc) }, doc.name),
      ),
    );
  };
  refreshList();
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.insertDocument),
    h("input", {
      type: "search",
      placeholder: COPY.searchDocument,
      value: state.query,
      "aria-label": COPY.searchDocument,
      oninput: (event: Event) => void search((event.target as HTMLInputElement).value),
      onfocus: () => {
        if (!state.documents) void search(state.query);
      },
    }),
    listHost,
    fileInput,
    h("button", { class: "link", disabled: state.busy, onclick: () => fileInput.click() }, COPY.addPdf),
  );
}

// A function, not a constant: the locale is only known once Office is ready
const styles = (): { value: LinkStyle; label: string; hint: string }[] => [
  { value: "card", label: COPY.card, hint: COPY.cardHint },
  { value: "text", label: COPY.plainLink, hint: COPY.plainLinkHint },
];

function linkStyleView() {
  const current = getLinkStyle();
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.linkStyleLegend),
    ...styles().map((style) =>
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
        h("span", {}, h("strong", {}, style.label), h("span", { class: "muted small" }, style.hint)),
      ),
    ),
  );
}

// Default: an attached PDF becomes a link on its own. Some sellers want to choose each time.
function askFirstView() {
  const askFirst = getAskFirst();
  const choices = [
    { value: false, label: COPY.replaceWithLink, hint: COPY.replaceWithLinkHint },
    { value: true, label: COPY.askFirst, hint: COPY.askFirstHint },
  ];
  return h(
    "fieldset",
    {},
    h("legend", {}, COPY.askFirstLegend),
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
        h("span", {}, h("strong", {}, choice.label), h("span", { class: "muted small" }, choice.hint)),
      ),
    ),
  );
}

function alertsView() {
  if (!state.alerts.length) return null;
  return h(
    "div",
    { class: "alerts" },
    // The pane keeps one ink action (the PDF swap): alert actions stay outline
    ...state.alerts.map((alert) =>
      h(
        "div",
        { class: alert.priority === "ACTION" ? "alert action" : "alert", role: "status" },
        h("strong", {}, h("span", { class: "dot", "aria-hidden": "true" }), alert.title),
        h("span", { class: "small muted" }, alert.body),
        h(
          "div",
          { class: "row" },
          alert.canMarkWon ? h("button", { class: "", onclick: () => void markWon(alert) }, COPY.markWon) : null,
          h("button", { onclick: () => openInBrowser(alert.url) }, COPY.open),
          h("button", { class: "link", onclick: () => dismissAlert(alert.id) }, COPY.ok),
        ),
      ),
    ),
  );
}

function readersView() {
  if (!state.readers.length) return h("p", { class: "muted small" }, COPY.nobodyReading);
  return h(
    "section",
    { class: "readings-block" },
    h("h2", {}, COPY.readingNow),
    readerRows(state.readers, (reader) => openInBrowser(`${APP_ORIGIN}/links/${reader.linkId}`)),
  );
}

// "Déconnecter" asks once, in place: no dialog, no second screen
function disconnectView() {
  const row = h("div", { class: "row" });
  const askButton = h("button", { class: "link", onclick: () => confirm() }, COPY.disconnect);
  const confirm = () =>
    row.replaceChildren(
      h("p", {}, COPY.disconnectConfirmOutlook),
      h("button", { class: "primary", onclick: () => void disconnect() }, COPY.disconnect),
      h("button", { onclick: () => row.replaceChildren(askButton) }, COPY.cancel),
    );
  row.append(askButton);
  return row;
}

// Folded by default; the pulse re-renders every 30 s, so the fold is remembered
function settingsView() {
  const account = state.account;
  return h(
    "details",
    {
      class: "settings",
      open: state.settingsOpen,
      ontoggle: (event: Event) => {
        state.settingsOpen = (event.target as HTMLDetailsElement).open;
      },
    },
    h("summary", {}, COPY.settings),
    linkStyleView(),
    askFirstView(),
    account ? h("p", { class: "muted small" }, COPY.connected(account.user.email)) : null,
    disconnectView(),
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
  return error instanceof Error && error.message ? error.message : COPY.error;
}

async function run(task: () => Promise<void>) {
  if (state.busy) return;
  state.busy = true;
  try {
    await task();
  } catch (error) {
    setStatus({ kind: "error", title: COPY.linkNotCreated, detail: messageOf(error) });
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
    step(COPY.preparingPdf);
    const document = await ensureDocument(new Uint8Array(await file.arrayBuffer()), file.name, (percent) =>
      step(COPY.uploadingPercent(percent)),
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
  const note = insertedNote(result);
  const target = result.link.manageUrl?.startsWith(`${APP_ORIGIN}/`) ? result.link.manageUrl : result.link.url;
  setStatus({
    kind: "done",
    title: COPY.linkInserted,
    detail: note ? `${result.link.title} · ${note}` : result.link.title,
    action: { label: COPY.seeLink, run: () => openInBrowser(target) },
  });
}

let searchToken = 0;

async function search(query: string) {
  state.query = query;
  const mine = ++searchToken;
  const documents = await searchDocuments(query.trim()).catch(() => []);
  if (mine !== searchToken) return;
  state.documents = documents;
  refreshList?.();
}

async function refreshAttachments() {
  const compose = composeItem();
  state.links = compose ? await readLinks(compose).catch(() => []) : [];
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

// "Marie a validé": the sale recorded from Outlook, follow-ups stop
async function markWon(alert: PulseAlert) {
  try {
    await api(`/api/ext/links/${encodeURIComponent(alert.linkId)}/won`, { method: "POST" });
    dismissAlert(alert.id);
    setStatus({ kind: "done", title: COPY.dealWon, detail: COPY.dealWonText });
  } catch {
    openInBrowser(alert.url);
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
  syncLocale();
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
