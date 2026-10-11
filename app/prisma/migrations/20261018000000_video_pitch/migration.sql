-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'VIDEO';

-- AlterEnum
ALTER TYPE "ProspectActionType" ADD VALUE 'REQUEST_QUOTE';

-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'QUOTE_REQUESTED';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "audioPathname" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "posterPathname" TEXT;

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "quoteRequestedAt" TIMESTAMP(3);
