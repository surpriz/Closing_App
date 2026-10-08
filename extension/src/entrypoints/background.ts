import { upload } from "@vercel/blob/client";
import { browser, type Browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { api, getToken, setToken } from "@/lib/api";
import { fromBase64 } from "@/lib/chunks";
import { API_ORIGIN, MAX_UPLOAD_BYTES } from "@/lib/config";
import {
  ClozerError,
  UPLOAD_PORT,
  type Account,
  type DocumentSummary,
  type Request,
  type Response,
  type UploadIn,
  type UploadOut,
} from "@/lib/messages";
import { safeFileName } from "@/lib/pdf";
import {
  CALL_MOMENTS_KEY,
  getCallMoments,
  lastReaders,
  listenToNotifications,
  pulse,
  PULSE_ALARM,
  startPulse,
  stopPulse,
} from "@/lib/pulse-runner";

const NONCE_KEY = "connectNonce";

async function startConnect() {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  await browser.storage.session.set({ [NONCE_KEY]: nonce });
  await browser.tabs.create({ url: `${API_ORIGIN}/extension/connect?nonce=${nonce}` });
  return null;
}

async function account() {
  if (!(await getToken())) return null;
  return api<Account>("/api/ext/me");
}

async function handle(request: Request): Promise<unknown> {
  switch (request.type) {
    case "account":
      return account();
    case "connect":
      return startConnect();
    case "disconnect":
      await api("/api/ext/token", { method: "DELETE" }).catch(() => undefined);
      await setToken(null);
      await stopPulse();
      return null;
    case "readers":
      return lastReaders();
    case "callMoments": {
      if (request.enabled === undefined) return getCallMoments();
      await browser.storage.local.set({ [CALL_MOMENTS_KEY]: request.enabled });
      // Same switch as in the app settings: stops the email fallback too
      await api("/api/ext/preferences", { method: "PATCH", body: { extensionCallMoments: request.enabled } }).catch(() => undefined);
      return request.enabled;
    }
    case "documents": {
      const q = request.q ? `?q=${encodeURIComponent(request.q)}` : "";
      return (await api<{ documents: DocumentSummary[] }>(`/api/ext/documents${q}`)).documents;
    }
    case "lookup":
      return (await api<{ document: DocumentSummary | null }>("/api/ext/documents/lookup", { body: { sha256: request.sha256 } }))
        .document;
    case "document":
      return (await api<{ document: DocumentSummary }>(`/api/ext/documents/${encodeURIComponent(request.id)}`)).document;
    case "link":
      return (
        await api<{ link: { id: string; name: string | null; title: string; url: string } }>("/api/ext/links", {
          body: { documentId: request.documentId, recipient: request.recipient, source: request.source },
        })
      ).link;
    case "sent":
      return api(`/api/ext/links/${encodeURIComponent(request.linkId)}/sent`, { body: { recipient: request.recipient } });
  }
}

function toResponse(error: unknown): Response {
  if (error instanceof ClozerError) return { ok: false, error: error.code, message: error.message };
  console.error("[clozer]", error);
  return { ok: false, error: "unknown", message: "Une erreur inattendue est survenue." };
}

// Receives the PDF in chunks, uploads it straight to Blob storage, then registers it
function receiveUpload(port: Browser.runtime.Port) {
  let meta: Extract<UploadIn, { kind: "start" }> | null = null;
  let parts: Uint8Array[] = [];
  let received = 0;
  const send = (message: UploadOut) => port.postMessage(message);

  port.onMessage.addListener(async (message: UploadIn) => {
    if (message.kind === "start") {
      meta = message;
      parts = [];
      received = 0;
      return;
    }
    if (!meta || message.kind === "ping") return;
    if (message.kind === "chunk") {
      const bytes = fromBase64(message.data);
      received += bytes.length;
      if (received > MAX_UPLOAD_BYTES) {
        send({ kind: "error", message: "Ce PDF dépasse 25 Mo." });
        port.disconnect();
        return;
      }
      parts.push(bytes);
      return;
    }

    if (received !== meta.size) {
      send({ kind: "error", message: "Le PDF n'a pas été reçu en entier. Réessayez." });
      return;
    }

    try {
      const me = await api<Account>("/api/ext/me");
      const token = await getToken();
      const pathname = `orgs/${me.organization.id}/documents/${safeFileName(meta.name)}`;
      const blob = await upload(pathname, new Blob(parts as BlobPart[], { type: "application/pdf" }), {
        access: "private",
        handleUploadUrl: `${API_ORIGIN}/api/ext/upload`,
        headers: { Authorization: `Bearer ${token}` },
        contentType: "application/pdf",
        multipart: received > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => send({ kind: "progress", percent: Math.round(percentage) }),
      });
      parts = [];
      const { document } = await api<{ document: DocumentSummary }>("/api/ext/documents", {
        body: { pathname: blob.pathname, name: meta.name, sha256: meta.sha256 },
      });
      send({ kind: "done", document });
    } catch (error) {
      const response = toResponse(error);
      send({ kind: "error", message: response.ok ? "" : response.message });
    }
  });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
    handle(request).then(
      (data) => sendResponse({ ok: true, data } satisfies Response),
      (error) => sendResponse(toResponse(error)),
    );
    return true;
  });

  // The app's /extension/connect page hands over the token
  browser.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
    const { type, token, nonce } = (message ?? {}) as { type?: string; token?: string; nonce?: string };
    if (type !== "clozer:connect" || sender.origin !== API_ORIGIN || typeof token !== "string") return;

    browser.storage.session.get(NONCE_KEY).then(async (stored) => {
      if (!nonce || stored[NONCE_KEY] !== nonce) return sendResponse({ ok: false });
      await browser.storage.session.remove(NONCE_KEY);
      await setToken(token);
      await startPulse();
      sendResponse({ ok: true });
    });
    return true;
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === UPLOAD_PORT) receiveUpload(port);
  });

  // "Reading now": alarms survive the service worker going to sleep
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PULSE_ALARM) void pulse();
  });
  browser.runtime.onStartup.addListener(() => void startPulse());
  browser.runtime.onInstalled.addListener(() => void startPulse());
  listenToNotifications();
});
