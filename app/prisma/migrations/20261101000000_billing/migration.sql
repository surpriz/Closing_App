-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "betaGrace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingInterval" TEXT,
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "planStatus" TEXT,
ADD COLUMN     "seats" INTEGER,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organizationId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripe_events_organizationId_receivedAt_idx" ON "stripe_events"("organizationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "stripe_events" ADD CONSTRAINT "stripe_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every workspace that exists today was created during the beta
UPDATE "organizations" SET "betaGrace" = true;
