import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { insertLink } from "@/adapters/insert";
import { composeRoot, findAttachmentRemover, findBodies, firstRecipient, insertionAnchor } from "@/adapters/mail";
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
import { sha256Hex } from "@/lib/sha256";
import { isOlder } from "@/lib/version";
import { ComposeWidget, removeLayer } from "@/ui/widget";

type Compose = {
  body: HTMLElement;
  root: HTMLElement;
  widget: ComposeWidget;
  saved: Range | null;
  // documentId → link already created for this email, so a retry reuses it
  links: Map<string, { url: string; title: string }>;
  busy: boolean;
};

const POLL_MS = 3000;
const POLL_TRIES = 20;
const UPLOAD_TIMEOUT_MS = 3 * 60_000;
// Lets the mail app show its attachment chip before the offer appears next to it
const OFFER_DELAY_MS = 300;

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

    const onStorage = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && "token" in changes) void loadAccount();
    };
    browser.storage.onChanged.addListener(onStorage);

    const composes = new Map<HTMLElement, Compose>();
    let lastCompose: Compose | null = null;

    ctx.onInvalidated(() => {
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
        link = await ask<{ url: string; title: string }>({ type: "link", documentId: document.id, recipient, source: host });
        compose.links.set(document.id, link);
      }
      const { url, title } = link;

      if (!insertLink(compose.body, compose.saved, insertionAnchor(host, compose.body), url, title)) {
        throw new ClozerError("insert", `Le lien n'a pas pu être inséré. Copiez-le : ${url}`);
      }

      let attachmentLeft = false;
      if (attachmentName) {
        const remover = findAttachmentRemover(compose.root, compose.body, attachmentName);
        remover?.click();
        if (remover) await sleep(1200);
        attachmentLeft = !remover || !!findAttachmentRemover(compose.root, compose.body, attachmentName);
      }

      const notes = [
        recipient ? `Prospect : ${recipient.displayName ?? recipient.email}.` : "Aucun destinataire : le prospect donnera son email à l'ouverture.",
        attachmentLeft ? "Pensez à retirer la pièce jointe." : null,
      ].filter(Boolean);
      compose.widget.message("Lien inséré", notes.join(" "), [{ label: "OK", run: () => compose.widget.hide() }]);
      if (!attachmentLeft) compose.widget.hideAfter(6000);

      void watchProcessing(compose, document);
    }

    async function replaceFile(compose: Compose, file: File, isAttachment: boolean) {
      if (file.size > MAX_UPLOAD_BYTES) throw new ClozerError("too_large", "Ce PDF dépasse 25 Mo.");
      compose.widget.progress("Préparation…", null);

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!hasPdfMagic(bytes)) throw new ClozerError("not_pdf", "Ce fichier n'est pas un PDF.");

      const sha256 = await sha256Hex(buffer);
      const existing = await ask<DocumentSummary | null>({ type: "lookup", sha256 });
      const document =
        existing ?? (await uploadPdf(file.name, bytes, sha256, (percent) => compose.widget.progress("Envoi du PDF…", Math.min(percent, 85))));

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
