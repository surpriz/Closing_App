import { createHash } from "node:crypto";

import { extractText, getDocumentProxy } from "unpdf";

import { deletePrivateBlob, readPrivateBlob } from "@/lib/blob";
import { inBackground } from "@/lib/closing/background";
import { prisma } from "@/lib/db";

import { detectPageTags } from "./page-tags";
import { readDocumentPages } from "./read-pages";

const MAX_PAGE_TEXT_CHARS = 20_000;

// The PDF header may follow a few junk bytes, never more than 1 KB (PDF spec)
export function hasPdfHeader(data: Uint8Array) {
  return Buffer.from(data.subarray(0, 1024)).includes("%PDF-");
}

// Extracts text per page and tags pages (pricing, terms...). Runs after the
// upload response; moves to a Trigger.dev task once jobs are wired.
export async function processDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, blobPathname: true },
  });
  // URL documents have no file and are ready from the start
  if (!document?.blobPathname) return;

  try {
    const data = await readPrivateBlob(document.blobPathname);
    // The content type comes from the uploader: check the bytes before handing them to the parser
    if (!hasPdfHeader(data)) throw new Error("Not a PDF file");
    // Before parsing: pdf.js may take ownership of the buffer. The hash the client sent is only a hint.
    const contentSha256 = createHash("sha256").update(data).digest("hex");
    const pdf = await getDocumentProxy(data);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pages = text.map((raw, index) => {
      // Postgres text columns reject NUL bytes, which some PDFs contain
      const clean = raw
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_PAGE_TEXT_CHARS);

      return {
        documentId,
        pageNumber: index + 1,
        text: clean || null,
        tags: detectPageTags(clean),
      };
    });

    // Translations of the old content go, their files with them
    const staleFiles = await prisma.documentFileTranslation.findMany({
      where: { documentId, blobPathname: { not: null } },
      select: { blobPathname: true },
    });
    await prisma.$transaction([
      prisma.documentPage.deleteMany({ where: { documentId } }),
      prisma.documentTranslation.deleteMany({ where: { documentId } }),
      prisma.documentFileTranslation.deleteMany({ where: { documentId } }),
      prisma.documentPage.createMany({ data: pages }),
      prisma.document.update({
        where: { id: documentId },
        data: {
          numPages: totalPages,
          contentSha256,
          status: "READY",
          processingError: null,
          aiProcessedAt: null,
          aiAttempts: 0,
        },
      }),
    ]);
    const stalePaths = staleFiles.map((file) => file.blobPathname!);
    if (stalePaths.length) inBackground("delete-stale-translations", () => deletePrivateBlob(stalePaths));
  } catch (error) {
    console.error(`[documents] processing failed for ${documentId}`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        processingError:
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });
    return;
  }

  // The document is usable from here; the AI reading only adds summaries and finer tags
  try {
    await readDocumentPages(documentId);
  } catch (error) {
    console.error(`[documents] AI page reading failed for ${documentId}`, error);
  }
}
