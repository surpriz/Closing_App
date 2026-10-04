-- CreateEnum
CREATE TYPE "InsightTrigger" AS ENUM ('SESSION_ENDED', 'PROSPECT_ACTION', 'SELLER_UPDATE', 'TIME_THRESHOLD', 'MANUAL');

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "brainDirtyAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "deal_insights" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trigger" "InsightTrigger" NOT NULL,
    "inputHash" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "momentum" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "signals" JSONB NOT NULL,
    "frictions" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "recommendedAction" JSONB NOT NULL,
    "followupBrief" JSONB,
    "scoreNuance" TEXT,
    "factsSnapshot" JSONB NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_insights_linkId_createdAt_idx" ON "deal_insights"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "deal_insights_organizationId_createdAt_idx" ON "deal_insights"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "deal_insights" ADD CONSTRAINT "deal_insights_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

