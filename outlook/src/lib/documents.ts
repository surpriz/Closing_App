import { upload } from "@vercel/blob/client";

import { linkHtml, type LinkStyle } from "@ext/link-html";
import { hasPdfMagic, safeFileName } from "@ext/pdf";
import type { Recipient } from "@ext/recipients";
import { sha256Hex } from "@ext/sha256";

import { api, type Account, type DocumentSummary, type LinkCreated } from "./api";
import { APP_ORIGIN, MAX_UPLOAD_BYTES } from "./config";
import { ClozerError } from "./errors";
import { getToken } from "./settings";

const TITLE_WAIT_MS = 15_000;
const TITLE_POLL_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Same PDF already in Clozer → reuse it. Otherwise straight to Blob storage, then registered.
export async function ensureDocument(bytes: Uint8Array, name: string, onProgress: (percent: number) => void) {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ClozerError("too_large", "Ce PDF dépasse 25 Mo.");
  if (!hasPdfMagic(bytes)) throw new ClozerError("not_pdf", "Ce fichier n'est pas un PDF lisible.");

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  // WebCrypto may be missing in classic Outlook's event runtime: then no reuse, the server dedupes anyway
  const sha256 = globalThis.crypto?.subtle ? await sha256Hex(buffer).catch(() => undefined) : undefined;
  if (sha256) {
    const existing = (await api<{ document: DocumentSummary | null }>("/api/ext/documents/lookup", { body: { sha256 } })).document;
    if (existing) return existing;
  }

  const me = await api<Account>("/api/ext/me");
  const blob = await upload(`orgs/${me.organization.id}/documents/${safeFileName(name)}`, new Blob([buffer], { type: "application/pdf" }), {
    access: "private",
    handleUploadUrl: `${APP_ORIGIN}/api/ext/upload`,
    headers: { Authorization: `Bearer ${getToken()}` },
    contentType: "application/pdf",
    multipart: bytes.length > 5 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  return (await api<{ document: DocumentSummary }>("/api/ext/documents", { body: { pathname: blob.pathname, name, sha256 } })).document;
}

// So the link reads "Devis rénovation cuisine" rather than the file name. Gives up after a few seconds.
export async function waitForTitle(document: DocumentSummary) {
  const deadline = Date.now() + TITLE_WAIT_MS;
  while (!document.titled && document.status !== "FAILED" && Date.now() < deadline) {
    await sleep(TITLE_POLL_MS);
    const latest = await api<{ document: DocumentSummary }>(`/api/ext/documents/${encodeURIComponent(document.id)}`)
      .then((data) => data.document)
      .catch(() => null);
    if (latest) document = latest;
  }
  return document;
}

export async function createLink(documentId: string, recipient: Recipient | null) {
  return (await api<{ link: LinkCreated }>("/api/ext/links", { body: { documentId, recipient, source: "outlook_addin" } })).link;
}

// Plain-text emails get the bare URL; same wording rule as the card (nothing about tracking)
export function linkContent(link: LinkCreated, bodyType: "html" | "text", style: LinkStyle) {
  return bodyType === "html" ? linkHtml(link.url, link.title, style) : `${link.title} : ${link.url}\n`;
}

export async function searchDocuments(q: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return (await api<{ documents: DocumentSummary[] }>(`/api/ext/documents${query}`)).documents;
}
