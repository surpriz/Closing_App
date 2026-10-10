-- AlterTable
ALTER TABLE "links" ADD COLUMN     "parentLinkId" TEXT;

-- CreateIndex
CREATE INDEX "links_parentLinkId_idx" ON "links"("parentLinkId");

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_parentLinkId_fkey" FOREIGN KEY ("parentLinkId") REFERENCES "links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
