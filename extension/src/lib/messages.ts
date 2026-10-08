import { browser } from "wxt/browser";

import type { Recipient } from "./recipients";

export type MailHost = "gmail" | "outlook";

// titled: the AI has given the document a readable title (or never will)
export type DocumentSummary = { id: string; name: string; status: string; titled?: boolean };

export type Account = {
  user: { name: string; email: string };
  organization: { id: string; name: string };
  appOrigin: string;
  minVersion: string | null;
  disabledHosts: string[];
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
  | { type: "sent"; linkId: string; recipient: Recipient | null };

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
  if (!response) throw new ClozerError("unavailable", "L'extension Clozer ne répond pas. Rechargez la page.");
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
