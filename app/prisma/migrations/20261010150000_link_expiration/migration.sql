-- AlterEnum
ALTER TYPE "FollowupTrigger" ADD VALUE 'EXPIRY_REMINDER';

-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'LINK_EXTENSION_REQUESTED';
ALTER TYPE "SellerAlertType" ADD VALUE 'LINK_EXPIRING';

-- AlterEnum
ALTER TYPE "ProspectActionType" ADD VALUE 'REQUEST_EXTENSION';

-- CreateIndex
CREATE INDEX "links_expiresAt_idx" ON "links"("expiresAt");
