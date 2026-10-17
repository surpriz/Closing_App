-- AlterEnum
ALTER TYPE "ProspectOrigin" ADD VALUE 'FORWARDED';

-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'DOCUMENT_FORWARDED';

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN "forwardedById" TEXT;

-- CreateTable
CREATE TABLE "link_forwards" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "fromProspectId" TEXT,
    "toProspectId" TEXT NOT NULL,
    "viewId" TEXT,
    "message" TEXT,
    "notifyOnOpen" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "ipHash" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "openedAt" TIMESTAMP(3),
    "receiptSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_forwards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prospects_forwardedById_idx" ON "prospects"("forwardedById");

-- CreateIndex
CREATE INDEX "link_forwards_linkId_createdAt_idx" ON "link_forwards"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "link_forwards_toProspectId_openedAt_idx" ON "link_forwards"("toProspectId", "openedAt");

-- CreateIndex
CREATE INDEX "link_forwards_visitorId_createdAt_idx" ON "link_forwards"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "link_forwards_ipHash_createdAt_idx" ON "link_forwards"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_forwardedById_fkey" FOREIGN KEY ("forwardedById") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_forwards" ADD CONSTRAINT "link_forwards_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_forwards" ADD CONSTRAINT "link_forwards_fromProspectId_fkey" FOREIGN KEY ("fromProspectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_forwards" ADD CONSTRAINT "link_forwards_toProspectId_fkey" FOREIGN KEY ("toProspectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
