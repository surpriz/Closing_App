import { deletePrivateBlob, documentUploadPrefix, headPrivateBlob } from "@/lib/blob";
import { inBackground } from "@/lib/closing/background";
import { prisma } from "@/lib/db";

import { processDocument } from "./process-document";

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

// Newest usable copy of this PDF in the workspace: same bytes, so no second upload or AI reading.
// READY only: their hash was recomputed from the stored file, the one a client sends is just a hint.
export function findReusableDocument(organizationId: string, contentSha256: string) {
  return prisma.document.findFirst({
    where: {
      organizationId,
      contentSha256,
      kind: "FILE",
      archivedAt: null,
      status: "READY",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true },
  });
}

// The caller sent something unusable, as opposed to an infrastructure failure
export class DocumentInputError extends Error {}

export type CreatedDocument = {
  document: { id: string; name: string; status: string };
  reused: boolean;
};

// Registers a PDF the browser (or the extension) already put in Blob storage
export async function createFileDocument(input: {
  organizationId: string;
  userId: string;
  pathname: string;
  name: string;
  sha256?: string;
}): Promise<CreatedDocument> {
  const { organizationId, userId, pathname } = input;
  if (!pathname.startsWith(documentUploadPrefix(organizationId))) {
    throw new DocumentInputError("Invalid document path");
  }

  // Trust Blob metadata, not what the browser claims
  const blob = await headPrivateBlob(pathname);
  if (blob.contentType !== "application/pdf") {
    throw new DocumentInputError("Only PDF files are supported");
  }

  // Registering the same file twice (a retry) returns the first registration
  const registered = await prisma.document.findFirst({
    where: { organizationId, blobPathname: blob.pathname, archivedAt: null },
    select: { id: true, name: true, status: true },
  });
  if (registered) return { document: registered, reused: true };

  const sha256 = isSha256(input.sha256) ? input.sha256 : null;
  if (sha256) {
    const existing = await findReusableDocument(organizationId, sha256);
    if (existing) {
      // This upload is a duplicate nobody points to: drop it
      inBackground("delete-duplicate-blob", () => deletePrivateBlob(pathname));
      return { document: existing, reused: true };
    }
  }

  const document = await prisma.document.create({
    data: {
      organizationId,
      ownerId: userId,
      name: input.name.replace(/\.pdf$/i, ""),
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      contentType: blob.contentType,
      sizeBytes: blob.size,
      contentSha256: sha256,
      status: "PROCESSING",
    },
    select: { id: true, name: true, status: true },
  });

  inBackground("process-document", () => processDocument(document.id));
  return { document, reused: false };
}
