-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'PROSPECT_QUESTION';

-- AlterTable
ALTER TABLE "workspace_settings" ALTER COLUMN "chatEnabledByDefault" SET DEFAULT true;

-- The setting never had a UI: every false is the old default
UPDATE "workspace_settings" SET "chatEnabledByDefault" = true;

-- AlterTable: new links only, links already sent keep chat off
ALTER TABLE "links" ALTER COLUMN "chatEnabled" SET DEFAULT true;

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropIndex
DROP INDEX "chat_messages_linkId_idx";

-- CreateIndex
CREATE INDEX "chat_messages_linkId_createdAt_idx" ON "chat_messages"("linkId", "createdAt");
