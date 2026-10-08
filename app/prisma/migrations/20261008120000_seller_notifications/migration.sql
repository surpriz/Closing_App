-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('ACTION', 'CALL', 'INFO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SellerAlertType" ADD VALUE 'PROSPECT_VALIDATED';
ALTER TYPE "SellerAlertType" ADD VALUE 'CHANGE_REQUESTED';
ALTER TYPE "SellerAlertType" ADD VALUE 'CALL_MOMENT';

-- AlterEnum
ALTER TYPE "SellerAlertChannel" ADD VALUE 'EXTENSION';

-- AlterTable
ALTER TABLE "seller_alerts" ADD COLUMN     "priority" "AlertPriority" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "emailActions" BOOLEAN NOT NULL DEFAULT true,
    "emailCallMoments" BOOLEAN NOT NULL DEFAULT false,
    "extensionCallMoments" BOOLEAN NOT NULL DEFAULT true,
    "morningDigest" BOOLEAN NOT NULL DEFAULT true,
    "digestHour" INTEGER NOT NULL DEFAULT 8,
    "timezone" TEXT,
    "lastDigestAt" TIMESTAMP(3),
    "digestClaimedAt" TIMESTAMP(3),
    "extensionSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_organizationId_key" ON "notification_preferences"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "seller_alerts_userId_createdAt_idx" ON "seller_alerts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "seller_alerts" ADD CONSTRAINT "seller_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

