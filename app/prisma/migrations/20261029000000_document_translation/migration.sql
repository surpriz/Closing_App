-- AlterEnum
ALTER TYPE "ViewSignalType" ADD VALUE 'TRANSLATED';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "language" TEXT;

-- AlterTable
ALTER TABLE "links" ADD COLUMN "translationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "view_signals" ADD COLUMN "detail" TEXT;

-- CreateTable
CREATE TABLE "document_translations" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_translations_documentId_locale_part_key" ON "document_translations"("documentId", "locale", "part");

-- AddForeignKey
ALTER TABLE "document_translations" ADD CONSTRAINT "document_translations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
