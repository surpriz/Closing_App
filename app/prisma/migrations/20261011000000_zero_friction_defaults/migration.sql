-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "requireEmailByDefault" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "voiceCommentsByDefault" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "followupsByDefault" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quoteExpiryDays" INTEGER DEFAULT 15;

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "autoSettings" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "prospect_actions" ADD COLUMN     "signerName" TEXT,
ADD COLUMN     "signerIpHash" TEXT,
ADD COLUMN     "signerAgent" TEXT,
ADD COLUMN     "documentSha256" TEXT;
