import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";

import { readWebPage } from "./inspect-web-link";
import { readDocumentPages, type ReadPagesOutcome } from "./read-pages";

/**
 * Reads a web page into a single page of text, so the AI can type it and the
 * prospect assistant can answer from it, and keeps its article for the reader
 * view when the site refuses framing. The page carries no tags: time spent
 * on "page 1" is time on the whole site, not on its pricing.
 */
export async function processWebDocument(
  documentId: string,
): Promise<ReadPagesOutcome | "no_text" | "unreachable"> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, kind: true, externalUrl: true },
  });
  if (document?.kind !== "URL" || !document.externalUrl) return "skipped";

  const content = await readWebPage(new URL(document.externalUrl));
  // A page down for a moment must not wipe what was read before
  if (!content) return "unreachable";
  const { text, readerHtml } = content;
  // What a signer had in front of them, as far as we could read it
  const contentSha256 = text ? createHash("sha256").update(text).digest("hex") : null;

  await prisma.$transaction([
    prisma.documentPage.deleteMany({ where: { documentId } }),
    // The page may have changed: translations of the old one must not be served
    prisma.documentTranslation.deleteMany({ where: { documentId } }),
    ...(text ? [prisma.documentPage.create({ data: { documentId, pageNumber: 1, text } })] : []),
    prisma.document.update({
      where: { id: documentId },
      data: { contentSha256, readerHtml, aiProcessedAt: null, aiAttempts: 0 },
    }),
  ]);
  if (!text) return "no_text";

  try {
    return await readDocumentPages(documentId);
  } catch (error) {
    console.error(`[documents] AI page reading failed for ${documentId}`, error);
    return "failed";
  }
}
