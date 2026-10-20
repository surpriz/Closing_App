-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('MANUAL', 'INBOUND', 'EXTENSION');

-- CreateEnum
CREATE TYPE "DealCloseReason" AS ENUM ('PRICE', 'TIMING', 'COMPETITOR', 'NO_DECISION', 'NO_NEED', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingOutcome" AS ENUM ('HELD', 'NO_SHOW', 'CANCELLED');

-- AlterEnum

ALTER TYPE "SellerAlertType" ADD VALUE 'PROSPECT_REPLIED';
ALTER TYPE "SellerAlertType" ADD VALUE 'EMAIL_BOUNCED';

-- AlterEnum

ALTER TYPE "ViewSignalType" ADD VALUE 'COPY_TEXT';
ALTER TYPE "ViewSignalType" ADD VALUE 'PRINT';

-- AlterTable
ALTER TABLE "workspace_settings" ALTER COLUMN "inactivityDays" SET DEFAULT ARRAY[3, 7, 14]::INTEGER[];

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "closedNote" TEXT,
ADD COLUMN     "closedReason" "DealCloseReason",
ADD COLUMN     "gateSeenAt" TIMESTAMP(3),
ADD COLUMN     "gateVisits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "meetingOutcome" "MeetingOutcome",
ADD COLUMN     "meetingOutcomeAt" TIMESTAMP(3),
ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "bounceDetail" TEXT,
ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "complainedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "document_views" ADD COLUMN     "followupId" TEXT;

-- AlterTable
ALTER TABLE "followups_queue" ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "seller_alerts" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "seller_activities" ADD COLUMN     "externalKey" TEXT,
ADD COLUMN     "fromEmail" TEXT,
ADD COLUMN     "source" "ActivitySource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "deal_insights" ADD COLUMN     "callScript" TEXT;

-- CreateIndex
CREATE INDEX "followups_queue_providerMessageId_idx" ON "followups_queue"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_activities_externalKey_key" ON "seller_activities"("externalKey");

-- AddForeignKey
ALTER TABLE "document_views" ADD CONSTRAINT "document_views_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "followups_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Workspaces still on the old default anti-ghosting steps get the new sequence (the last step closes the loop)
UPDATE "workspace_settings" SET "inactivityDays" = ARRAY[3, 7, 14]::INTEGER[] WHERE "inactivityDays" = ARRAY[3, 5]::INTEGER[];
