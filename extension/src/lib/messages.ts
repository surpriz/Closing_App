import { browser } from "wxt/browser";

import { COPY } from "./copy";
import type { Recipient } from "./recipients";

export type MailHost = "gmail" | "outlook";

// titled: the AI has given the document a readable title (or never will)
export type DocumentSummary = { id: string; name: string; status: string; titled?: boolean };

/** POST /api/ext/links: the link, what the prospect will meet, and where to change it. */
export type CreatedLink = { id: string; url: string; title: string; summary?: string[]; manageUrl?: string };

export type Account = {
  user: { name: string; email: string };
  organization: { id: string; name: string };
  appOrigin: string;
  minVersion: string | null;
  disabledHosts: string[];
  /** Server kill switch for the badge and notifications. */
  notificationsEnabled?: boolean;
};

// Content script / popup → background (one-shot)
export type Request =
  | { type: "account" }
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "documents"; q?: string }
  | { type: "lookup"; sha256: string }
  | { type: "document"; id: string }
  | { type: "link"; documentId: string; recipient: Recipient | null; source: MailHost }
  // The email holding this link was sent: the draft becomes a deal
  | { type: "sent"; linkId: string; recipient: Recipient | null }
  // "Marquer gagné" on a "validé" banner
  | { type: "markWon"; linkId: string }
  // Popup: who is reading now, and the "notify me" switch
  | { type: "readers" }
  | { type: "callMoments"; enabled?: boolean }
  | { type: "testNotification" }
  // Gmail / Outlook banner buttons
  | { type: "dismissBanner"; alertId: string; snoozeLinkId?: string }
  | { type: "openUrl"; url: string }
  // The app no longer accepts this version: fetch the new one from the Web Store
  | { type: "update" };

export type UpdateStatus = "updating" | "no_update" | "throttled";

/** Asks the background for the new version and says what happened, for the seller. */
export async function requestUpdate() {
  const status = await ask<UpdateStatus>({ type: "update" }).catch(() => "no_update" as const);
  return status === "updating" ? COPY.updating : COPY.updateNotYet;
}

// MAIN-world capture script → isolated content script (window.postMessage)
export const CAPTURE_SOURCE = "clozer-capture";
export const CAPTURE_NONCE_ATTR = "data-clozer-capture";

export type CaptureMessage = { source: typeof CAPTURE_SOURCE; nonce: string; files: File[] };

export type Response<T = unknown> = { ok: true; data: T } | { ok: false; error: string; message: string };

// Upload over a Port: start, chunks, end. The background answers with progress, then done or error.
export const UPLOAD_PORT = "clozer-upload";

export type UploadIn =
  | { kind: "start"; name: string; size: number; sha256: string }
  | { kind: "chunk"; data: string }
  | { kind: "end" }
  // Keeps the service worker awake while the upload runs
  | { kind: "ping" };

export type UploadOut =
  | { kind: "progress"; percent: number }
  | { kind: "done"; document: DocumentSummary }
  | { kind: "error"; message: string };

export async function ask<T>(request: Request): Promise<T> {
  const response = (await browser.runtime.sendMessage(request)) as Response<T> | undefined;
  if (!response) throw new ClozerError("unavailable", COPY.extensionNotResponding);
  if (!response.ok) throw new ClozerError(response.error, response.message);
  return response.data;
}

export class ClozerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
