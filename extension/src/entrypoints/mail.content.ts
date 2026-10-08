import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { insertLink } from "@/adapters/insert";
import {
  composeRoot,
  findAttachmentRemover,
  findBodies,
  firstRecipient,
  insertionAnchor,
  isSendControl,
  press,
} from "@/adapters/mail";
import { splitChunks } from "@/lib/chunks";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { MAIL_MATCHES, mailHost } from "@/lib/hosts";
import {
  ask,
  CAPTURE_NONCE_ATTR,
  CAPTURE_SOURCE,
  ClozerError,
  UPLOAD_PORT,
  type Account,
  type CaptureMessage,
  type DocumentSummary,
  type UploadIn,
  type UploadOut,
} from "@/lib/messages";
import { hasPdfMagic, looksLikePdf } from "@/lib/pdf";
import { getLinkStyle } from "@/lib/preferences";
import { bannersToShow, MAIL_ALERTS_KEY, MAIL_DISMISSED_KEY, type MailAlert } from "@/lib/pulse";
import { sha256Hex } from "@/lib/sha256";
import { isOlder } from "@/lib/version";
import { renderBanners } from "@/ui/banner";
import { ComposeWidget, removeLayer } from "@/ui/widget";

type Compose = {
  body: HTMLElement;
  root: HTMLElement;
  widget: ComposeWidget;
  saved: Range | null;
  // documentId → link already created for this email, so a retry reuses it
  links: Map<string, { id: string; url: string; title: string }>;
  busy: boolean;
  sending: boolean;
};

const POLL_MS = 3000;
const POLL_TRIES = 20;
const UPLOAD_TIMEOUT_MS = 3 * 60_000;
// A fresh PDF gets its readable title from the AI a few seconds after upload
const TITLE_WAIT_MS = 15_000;
const TITLE_POLL_MS = 1000;
// Lets the mail app show its attachment chip before the offer appears next to it
const OFFER_DELAY_MS = 300;
// After Send, the mail app closes the compose within a few seconds when the email really left
const SENT_WATCH_MS = 10_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sends the PDF to the background in chunks; the background uploads it
function uploadPdf(name: string, bytes: Uint8Array, sha256: string, onProgress: (percent: number) => void) {
  return new Promise<DocumentSummary>((resolve, reject) => {
    const port = browser.runtime.connect({ name: UPLOAD_PORT });
    const send = (message: UploadIn) => port.postMessage(message);
    const ping = setInterval(() => send({ kind: "ping" }), 20_000);
    const timeout = setTimeout(() => fail("L'envoi prend trop de temps. Réessayez."), UPLOAD_TIMEOUT_MS);
    const stop = () => {
      clearInterval(ping);
      clearTimeout(timeout);
    };
    function fail(message: string) {
      stop();
      port.disconnect();
      reject(new ClozerError("upload", message));
    }

    port.onMessage.addListener((message: UploadOut) => {
      if (message.kind === "progress") return onProgress(message.percent);
      if (message.kind === "error") return fail(message.message);
      stop();
      port.disconnect();
      resolve(message.document);
    });
    port.onDisconnect.addListener(() => {
      stop();
      reject(new ClozerError("upload", "L'envoi a été interrompu. Réessayez."));
    });

    send({ kind: "start", name, size: bytes.length, sha256 });
    for (const data of splitChunks(bytes)) send({ kind: "chunk", data });
    send({ kind: "end" });
  });
}

export default defineContentScript({
  matches: MAIL_MATCHES,
  runAt: "document_idle",
  async main(ctx) {
    const detected = mailHost(location.hostname);
    if (!detected) return;
    const host = detected;

    const nonce = crypto.randomUUID();
    document.documentElement.setAttribute(CAPTURE_NONCE_ATTR, nonce);

    // Only a rejected token means "not connected": offline or a server error keeps what we knew
    let account: Account | null = null;
    const loadAccount = async () => {
      try {
        account = await ask<Account | null>({ type: "account" });
      } catch (error) {
        if (error instanceof ClozerError && error.code === "unauthorized") account = null;
      }
    };
    await loadAccount();

    // Remote kill switch: a broken adapter can be turned off without a store release
    const version = browser.runtime.getManifest().version;
    const remote = account as Account | null;
    if (remote && (remote.disabledHosts.includes(host) || (remote.minVersion && isOlder(version, remote.minVersion)))) {
      return;
    }

    // "Reading now" banners: same alerts as the Chrome notifications, shown in
    // the page so they work even when the OS blocks Chrome's notifications
    const showBanners = async () => {
      if (!account || account.notificationsEnabled === false) return renderBanners([], bannerHandlers);
      const stored = await browser.storage.local.get([MAIL_ALERTS_KEY, MAIL_DISMISSED_KEY]);
      const alerts = (stored[MAIL_ALERTS_KEY] as MailAlert[] | undefined) ?? [];
      const dismissed = (stored[MAIL_DISMISSED_KEY] as string[] | undefined) ?? [];
      renderBanners(bannersToShow(alerts, dismissed, Date.now()), bannerHandlers);
    };
    const bannerHandlers = {
      open: (alert: MailAlert) => {
        void ask({ type: "openUrl", url: alert.url });
        void ask({ type: "dismissBanner", alertId: alert.id });
      },
      later: (alert: MailAlert) => void ask({ type: "dismissBanner", alertId: alert.id, snoozeLinkId: alert.linkId }),
      close: (alert: MailAlert) => void ask({ type: "dismissBanner", alertId: alert.id }),
    };
    void showBanners();
    // Call moments go stale after a few minutes even without a new alert
    const bannerTimer = setInterval(() => void showBanners(), 60_000);

    const onStorage = (changes: Record<string, unknown>, area: string) => {
      if (area !== "local") return;
      if ("token" in changes) void loadAccount().then(showBanners);
      if (MAIL_ALERTS_KEY in changes || MAIL_DISMISSED_KEY in changes) void showBanners();
    };
    browser.storage.onChanged.addListener(onStorage);

    const composes = new Map<HTMLElement, Compose>();
    let lastCompose: Compose | null = null;

    ctx.onInvalidated(() => {
      clearInterval(bannerTimer);
      browser.storage.onChanged.removeListener(onStorage);
      composes.clear();
      removeLayer();
    });

    const composeOf = (node: EventTarget | Node | null) => {
      if (!(node instanceof Node)) return null;
      for (const compose of composes.values()) if (compose.root.contains(node)) return compose;
      return null;
    };

    const connectAction = (compose: Compose) => ({
      label: "Connecter Clozer",
      primary: true,
      run: () => {
        void ask({ type: "connect" });
        compose.widget.message("Connexion en cours", "Validez dans l'onglet Clozer, puis revenez ici.");
      },
    });
    const ignoreAction = (compose: Compose) => ({ label: "Ignorer", run: () => compose.widget.hide() });

    async function run(compose: Compose, task: () => Promise<void>) {
      if (compose.busy) return;
      compose.busy = true;
      try {
        await task();
      } catch (error) {
        if (error instanceof ClozerError && error.code === "unauthorized") {
          account = null;
          compose.widget.error(error.message, [connectAction(compose)]);
        } else {
          compose.widget.error(error instanceof Error ? error.message : "Une erreur est survenue.");
        }
      } finally {
        compose.busy = false;
      }
    }

    // A fresh PDF is read in a few seconds; warn only if it fails, and never over something else
    async function watchProcessing(compose: Compose, document: DocumentSummary) {
      for (let i = 0; i < POLL_TRIES && document.status === "PROCESSING" && ctx.isValid; i++) {
        await sleep(POLL_MS);
        if (!compose.body.isConnected) return;
        document = await ask<DocumentSummary>({ type: "document", id: document.id }).catch(() => document);
      }
      if (document.status === "FAILED" && compose.body.isConnected && compose.widget.idle) {
        compose.widget.error("Ce PDF n'a pas pu être préparé. Retirez le lien et ajoutez le document depuis Clozer.");
      }
    }

    // Link for this email (first "To" recipient = prospect), inserted where the seller was typing
    async function insertDocument(compose: Compose, document: DocumentSummary, attachmentName?: string) {
      compose.widget.progress("Création du lien…", 90);
      const recipient = firstRecipient(host, compose.root, compose.body);

      let link = compose.links.get(document.id);
      if (!link) {
        link = await ask<{ id: string; url: string; title: string }>({ type: "link", documentId: document.id, recipient, source: host });
        compose.links.set(document.id, link);
      }
      const style = await getLinkStyle();
      if (!insertLink(compose.body, compose.saved, insertionAnchor(host, compose.body), { ...link, style })) {
        throw new ClozerError("insert", `Le lien n'a pas pu être inséré. Copiez-le : ${link.url}`);
      }

      let attachmentLeft = false;
      if (attachmentName) {
        const remover = findAttachmentRemover(compose.root, compose.body, attachmentName);
        if (remover) {
          press(remover);
          await sleep(1200);
        }
        attachmentLeft = !remover || !!findAttachmentRemover(compose.root, compose.body, attachmentName);
      }

      const notes = [
        recipient
          ? `Prospect : ${recipient.displayName ?? recipient.email}. Le suivi démarre à l'envoi.`
          : "Le suivi démarre à l'envoi, avec le destinataire de l'email.",
        attachmentLeft ? "Pensez à retirer la pièce jointe." : null,
      ].filter(Boolean);
      compose.widget.message("Lien inséré", notes.join(" "), [{ label: "OK", run: () => compose.widget.hide() }]);
      if (!attachmentLeft) compose.widget.hideAfter(6000);

      void watchProcessing(compose, document);
    }

    // So the link reads "Devis rénovation cuisine" rather than the file name. Gives up after a few seconds.
    async function waitForTitle(compose: Compose, document: DocumentSummary) {
      const deadline = Date.now() + TITLE_WAIT_MS;
      while (Date.now() < deadline && ctx.isValid) {
        compose.widget.progress("Lecture du document…", 75 + Math.round((10 * (TITLE_WAIT_MS - (deadline - Date.now()))) / TITLE_WAIT_MS));
        await sleep(TITLE_POLL_MS);
        const latest = await ask<DocumentSummary>({ type: "document", id: document.id }).catch(() => null);
        if (latest) document = latest;
        if (document.titled || document.status === "FAILED") break;
      }
      return document;
    }

    async function replaceFile(compose: Compose, file: File, isAttachment: boolean) {
      if (file.size > MAX_UPLOAD_BYTES) throw new ClozerError("too_large", "Ce PDF dépasse 25 Mo.");
      compose.widget.progress("Préparation…", null);

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!hasPdfMagic(bytes)) throw new ClozerError("not_pdf", "Ce fichier n'est pas un PDF.");

      const sha256 = await sha256Hex(buffer);
      const existing = await ask<DocumentSummary | null>({ type: "lookup", sha256 });
      let document =
        existing ?? (await uploadPdf(file.name, bytes, sha256, (percent) => compose.widget.progress("Envoi du PDF…", Math.min(percent, 70))));
      if (!existing) document = await waitForTitle(compose, document);

      await insertDocument(compose, document, isAttachment ? file.name : undefined);
    }

    function offer(compose: Compose, file: File) {
      if (compose.busy) return;
      if (!account) {
        compose.widget.message(`Envoyer « ${file.name} » en lien ?`, "Connectez Clozer pour remplacer la pièce jointe par un lien.", [
          connectAction(compose),
          ignoreAction(compose),
        ]);
        return;
      }
      compose.widget.message(`Remplacer « ${file.name} » par un lien Clozer ?`, null, [
        { label: "Remplacer", primary: true, run: () => void run(compose, () => replaceFile(compose, file, true)) },
        ignoreAction(compose),
      ]);
    }

    function offerFirstPdf(files: Iterable<File> | null | undefined, compose: Compose | null) {
      const pdf = Array.from(files ?? []).find(looksLikePdf);
      if (pdf && compose) setTimeout(() => offer(compose, pdf), OFFER_DELAY_MS);
    }

    function openPicker(compose: Compose) {
      if (compose.busy) return;
      if (compose.widget.showingPicker) return compose.widget.hide();
      if (!account) {
        compose.widget.message("Clozer n'est pas connecté", "Connectez votre compte pour insérer vos documents.", [
          connectAction(compose),
          ignoreAction(compose),
        ]);
        return;
      }
      compose.widget.picker({
        load: (q) => ask<DocumentSummary[]>({ type: "documents", q }),
        pickDocument: (document) => void run(compose, () => insertDocument(compose, document)),
        pickFile: (file) => void run(compose, () => replaceFile(compose, file, false)),
      });
    }

    // Finds new and closed composes. Cheap enough once a second.
    function discover() {
      for (const body of findBodies()) {
        if (composes.has(body)) continue;
        const compose: Compose = {
          body,
          root: composeRoot(host, body),
          widget: new ComposeWidget(() => openPicker(compose)),
          saved: null,
          links: new Map(),
          busy: false,
          sending: false,
        };
        composes.set(body, compose);
      }
      for (const [body, compose] of composes) {
        if (body.isConnected) continue;
        compose.widget.destroy();
        composes.delete(body);
        if (lastCompose === compose) lastCompose = null;
      }
    }

    // Keeps each button on its compose while the seller scrolls, resizes or moves it
    function follow() {
      for (const compose of composes.values()) compose.widget.place(compose.body.getBoundingClientRect());
      ctx.requestAnimationFrame(follow);
    }

    discover();
    ctx.setInterval(discover, 1000);
    ctx.requestAnimationFrame(follow);

    ctx.addEventListener(document, "selectionchange", () => {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const compose = range && composeOf(range.startContainer);
      if (compose && compose.body.contains(range.startContainer)) {
        compose.saved = range.cloneRange();
        lastCompose = compose;
      }
    });
    ctx.addEventListener(document, "focusin", (event) => {
      lastCompose = composeOf(event.target) ?? lastCompose;
    });

    // Send pressed: keep the recipients as they are now, then confirm once the compose closes.
    // A compose that stays open means the mail app refused to send; nothing is confirmed.
    async function onSend(compose: Compose) {
      if (!compose.links.size || compose.sending) return;
      compose.sending = true;
      const recipient = firstRecipient(host, compose.root, compose.body);
      const deadline = Date.now() + SENT_WATCH_MS;
      while (compose.body.isConnected && Date.now() < deadline && ctx.isValid) await sleep(500);
      if (compose.body.isConnected) {
        compose.sending = false;
        return;
      }
      for (const link of compose.links.values()) {
        await ask({ type: "sent", linkId: link.id, recipient }).catch(() => undefined);
      }
    }

    ctx.addEventListener(
      document,
      "mousedown",
      (event) => {
        const compose = composeOf(event.target);
        if (compose && isSendControl(event.target, compose.root, compose.body)) void onSend(compose);
      },
      { capture: true },
    );
    ctx.addEventListener(
      document,
      "keydown",
      (event) => {
        if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
        const compose = composeOf(event.target);
        if (compose) void onSend(compose);
      },
      { capture: true },
    );

    // Dropped or pasted into a compose: the event target tells which one
    ctx.addEventListener(window, "drop", (event) => offerFirstPdf(event.dataTransfer?.files, composeOf(event.target) ?? lastCompose), {
      capture: true,
    });
    ctx.addEventListener(window, "paste", (event) => offerFirstPdf(event.clipboardData?.files, composeOf(event.target) ?? lastCompose), {
      capture: true,
    });

    // Picked through the paperclip: reported by the MAIN-world capture script
    ctx.addEventListener(window, "message", (event: MessageEvent<CaptureMessage>) => {
      if (event.source !== window || event.data?.source !== CAPTURE_SOURCE || event.data.nonce !== nonce) return;
      offerFirstPdf(event.data.files, lastCompose ?? (composes.size === 1 ? [...composes.values()][0] : null));
    });
  },
});
