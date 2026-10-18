import type { FileTranslationStatus } from "@/generated/prisma/enums";
import { organizationPrefix, putPrivateBlob, readPrivateBlob } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { recordAiUsage } from "../ai/usage";
import { canTranslate } from "../brain/budget";
import type { SupportedLocale } from "../constants";
import {
  deeplConfig,
  deeplCostMicroUsd,
  DeeplError,
  documentStatus,
  downloadDocument,
  uploadDocument,
  type DeeplConfig,
} from "./deepl";

/** An upload that never got its DeepL ids: the request that sent it died. */
const UPLOAD_STALE_MS = 2 * 60 * 1000;
/** DeepL keeps a result for a limited time: past this, the job is sent again. */
const JOB_STALE_MS = 30 * 60 * 1000;
/** A failed translation is not paid for again on every page load. */
const RETRY_FAILED_MS = 10 * 60 * 1000;

type Row = { status: FileTranslationStatus; deeplDocumentId: string | null; updatedAt: Date };
export type FileTranslationStep = "serve" | "poll" | "wait" | "start" | "failed";

/** What to do for a reader asking for the translated PDF, from what we have for it. */
export function fileTranslationStep(row: Row | null, now = new Date()): FileTranslationStep {
  if (!row) return "start";
  const age = now.getTime() - row.updatedAt.getTime();
  if (row.status === "DONE") return "serve";
  if (row.status === "FAILED") return age < RETRY_FAILED_MS ? "failed" : "start";
  if (!row.deeplDocumentId) return age < UPLOAD_STALE_MS ? "wait" : "start";
  return age < JOB_STALE_MS ? "poll" : "start";
}

export type FileTranslationState =
  | { status: "done" }
  | { status: "pending"; secondsRemaining: number | null }
  | { status: "failed" }
  | { status: "budget" };

type Scope = { organizationId: string; linkId: string };
type SourceDocument = { id: string; name: string; blobPathname: string | null };

/**
 * Moves a PDF translation one step forward and says where it stands. The
 * viewer asks again every few seconds until it is done, so no job runs in
 * the background: a translation left halfway is picked up by the next reader.
 */
export async function advanceFileTranslation(
  scope: Scope,
  document: SourceDocument,
  locale: SupportedLocale,
): Promise<FileTranslationState> {
  const config = deeplConfig();
  if (!config || !document.blobPathname) return { status: "failed" };
  const where = { documentId_locale: { documentId: document.id, locale } };
  const row = await prisma.documentFileTranslation.findUnique({ where });

  switch (fileTranslationStep(row)) {
    case "serve":
      return { status: "done" };
    case "failed":
      return { status: "failed" };
    case "wait":
      return { status: "pending", secondsRemaining: null };
    case "poll":
      return poll(config, scope, document, row!);
    case "start":
      if (!(await canTranslate(scope.organizationId))) return { status: "budget" };
      return start(config, document, locale, row);
  }
}

async function start(config: DeeplConfig, document: SourceDocument, locale: SupportedLocale, row: (Row & { id: string }) | null) {
  // Claimed by one request only: two readers arriving together send the PDF once
  const claimed = row
    ? await prisma.documentFileTranslation.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { status: "PENDING", deeplDocumentId: null, deeplDocumentKey: null, error: null },
      })
    : await prisma.documentFileTranslation.createMany({
        data: { documentId: document.id, locale },
        skipDuplicates: true,
      });
  if (claimed.count === 0) return { status: "pending" as const, secondsRemaining: null };

  const where = { documentId_locale: { documentId: document.id, locale } };
  try {
    const bytes = await readPrivateBlob(document.blobPathname!);
    const { documentId, documentKey } = await uploadDocument(config, { bytes, filename: `${document.id}.pdf` }, locale);
    await prisma.documentFileTranslation.update({
      where,
      data: { deeplDocumentId: documentId, deeplDocumentKey: documentKey },
    });
    return { status: "pending" as const, secondsRemaining: null };
  } catch (error) {
    console.error(`[translation] DeepL upload failed for ${document.id} ${locale}`, error);
    await prisma.documentFileTranslation.update({ where, data: { status: "FAILED", error: String(error).slice(0, 500) } });
    return { status: "failed" as const };
  }
}

async function poll(
  config: DeeplConfig,
  scope: Scope,
  document: SourceDocument,
  row: Row & { id: string; locale: string; deeplDocumentKey: string | null },
): Promise<FileTranslationState> {
  const startedAt = Date.now();
  try {
    const status = await documentStatus(config, row.deeplDocumentId!, row.deeplDocumentKey!);
    if (status.status === "error") {
      await prisma.documentFileTranslation.update({
        where: { id: row.id },
        data: { status: "FAILED", error: status.error?.slice(0, 500) ?? "DeepL error" },
      });
      return { status: "failed" };
    }
    if (status.status !== "done") return { status: "pending", secondsRemaining: status.secondsRemaining };

    const bytes = await downloadDocument(config, row.deeplDocumentId!, row.deeplDocumentKey!);
    const blob = await putPrivateBlob(
      `${organizationPrefix(scope.organizationId)}translations/${document.id}-${row.locale}.pdf`,
      bytes,
      "application/pdf",
    );
    await prisma.documentFileTranslation.update({
      where: { id: row.id },
      data: {
        status: "DONE",
        blobPathname: blob.pathname,
        billedCharacters: status.billedCharacters,
        deeplDocumentKey: null,
        error: null,
      },
    });
    await recordAiUsage({
      organizationId: scope.organizationId,
      linkId: scope.linkId,
      purpose: "translate",
      provider: "deepl",
      modelId: "deepl-document",
      latencyMs: Date.now() - startedAt,
      ok: true,
      costMicroUsd: deeplCostMicroUsd(status.billedCharacters, getEnv().DEEPL_PRICE_PER_MILLION_USD),
    });
    return { status: "done" };
  } catch (error) {
    // 404 or 503 after another reader's request downloaded it first: theirs stores it. Else the next ask tries again
    const takenByOther = error instanceof DeeplError && (error.status === 404 || error.status === 503);
    if (!takenByOther) console.error(`[translation] DeepL poll failed for ${document.id} ${row.locale}`, error);
    return { status: "pending", secondsRemaining: null };
  }
}

/** The translated PDF a reader may download or view, once it is done. */
export async function translatedFilePathname(documentId: string, locale: SupportedLocale) {
  const row = await prisma.documentFileTranslation.findUnique({
    where: { documentId_locale: { documentId, locale } },
    select: { status: true, blobPathname: true },
  });
  return row?.status === "DONE" ? row.blobPathname : null;
}
