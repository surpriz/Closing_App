-- CreateEnum
CREATE TYPE "FollowupSentVia" AS ENUM ('PLATFORM', 'MANUAL');

-- CreateEnum
CREATE TYPE "Autonomy" AS ENUM ('COPILOT', 'AUTOPILOT');

-- CreateEnum
CREATE TYPE "SellerActivityType" AS ENUM ('CALL', 'EMAIL_REPLY_RECEIVED', 'MEETING', 'NOTE', 'MANUAL_SEND');

-- AlterEnum
ALTER TYPE "FollowupTrigger" ADD VALUE 'AI_DECISION';

-- AlterEnum
ALTER TYPE "FollowupStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "autonomy" "Autonomy" NOT NULL DEFAULT 'COPILOT',
ADD COLUMN     "autopilotMinConfidence" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "avgSalesCycleDays" INTEGER,
ADD COLUMN     "commonObjections" TEXT,
ADD COLUMN     "maxFollowupsPer30Days" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "minDaysBetweenFollowups" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "minDelayAfterReadingHours" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "offerDescription" TEXT,
ADD COLUMN     "targetCustomer" TEXT,
ADD COLUMN     "valueProps" TEXT;

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "dealAmountCents" INTEGER,
ADD COLUMN     "dealCurrency" TEXT,
ADD COLUMN     "decisionDeadline" TIMESTAMP(3),
ADD COLUMN     "decisionMakerName" TEXT,
ADD COLUMN     "decisionMakerRole" TEXT,
ADD COLUMN     "sellerNotes" TEXT,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "followups_queue" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "confidence" INTEGER,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "insightId" TEXT,
ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "regenerateInstruction" TEXT,
ADD COLUMN     "sentVia" "FollowupSentVia";

-- CreateTable
CREATE TABLE "seller_activities" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "prospectId" TEXT,
    "userId" TEXT,
    "type" "SellerActivityType" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_activities_linkId_occurredAt_idx" ON "seller_activities"("linkId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_organizationId_createdAt_idx" ON "ai_usage"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "seller_activities" ADD CONSTRAINT "seller_activities_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

