import { extractText, getDocumentProxy } from "unpdf";

import { readPrivateBlob } from "@/lib/blob";
import { prisma } from "@/lib/db";

import { detectPageTags } from "./page-tags";

const MAX_PAGE_TEXT_CHARS = 20_000;

// Extracts text per page and tags pages (pricing, terms...). Runs after the
// upload response; moves to a Trigger.dev task once jobs are wired.
export async function processDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, blobPathname: true },
  });
  if (!document) return;

  try {
    const data = await readPrivateBlob(document.blobPathname);
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

    await prisma.$transaction([
      prisma.documentPage.deleteMany({ where: { documentId } }),
      prisma.documentPage.createMany({ data: pages }),
      prisma.document.update({
        where: { id: documentId },
        data: { numPages: totalPages, status: "READY", processingError: null },
      }),
    ]);
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
  }
}
