-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "aiAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiProcessedAt" TIMESTAMP(3),
ADD COLUMN     "sellerDescription" TEXT;

-- AlterTable
ALTER TABLE "document_pages" ADD COLUMN     "keyFacts" TEXT[] DEFAULT ARRAY[]::TEXT[];

