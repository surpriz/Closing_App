-- CreateEnum
CREATE TYPE "ViewSignalType" AS ENUM ('EXTERNAL_OPEN', 'EXTERNAL_RETURN', 'DOWNLOAD', 'EXIT_PROMPT_SHOWN', 'EXIT_PROMPT_OPENED');

-- CreateTable
CREATE TABLE "view_signals" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "type" "ViewSignalType" NOT NULL,
    "valueMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "view_signals_linkId_createdAt_idx" ON "view_signals"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "view_signals_viewId_idx" ON "view_signals"("viewId");

-- AddForeignKey
ALTER TABLE "view_signals" ADD CONSTRAINT "view_signals_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "document_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_signals" ADD CONSTRAINT "view_signals_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

