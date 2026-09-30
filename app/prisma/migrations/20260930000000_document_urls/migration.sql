-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('FILE', 'URL');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "embedUrl" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "kind" "DocumentKind" NOT NULL DEFAULT 'FILE',
ALTER COLUMN "blobUrl" DROP NOT NULL,
ALTER COLUMN "blobPathname" DROP NOT NULL,
ALTER COLUMN "sizeBytes" SET DEFAULT 0;
