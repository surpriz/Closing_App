-- CreateEnum
CREATE TYPE "FileTranslationStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "document_file_translations" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "FileTranslationStatus" NOT NULL DEFAULT 'PENDING',
    "deeplDocumentId" TEXT,
    "deeplDocumentKey" TEXT,
    "blobPathname" TEXT,
    "billedCharacters" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_file_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_file_translations_documentId_locale_key" ON "document_file_translations"("documentId", "locale");

-- AddForeignKey
ALTER TABLE "document_file_translations" ADD CONSTRAINT "document_file_translations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
