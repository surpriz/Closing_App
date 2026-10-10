-- CreateEnum
CREATE TYPE "CapsuleKind" AS ENUM ('VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "VoiceCommentStatus" AS ENUM ('PENDING', 'TRANSCRIBED', 'FAILED');

-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'VOICE_COMMENT';

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "voiceCommentsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "page_capsules" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "linkId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "kind" "CapsuleKind" NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "hookText" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_capsules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capsule_plays" (
    "id" TEXT NOT NULL,
    "capsuleId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capsule_plays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_comments" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "prospectId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" "VoiceCommentStatus" NOT NULL DEFAULT 'PENDING',
    "transcript" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_capsules_linkId_idx" ON "page_capsules"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "page_capsules_documentId_pageNumber_scopeKey_key" ON "page_capsules"("documentId", "pageNumber", "scopeKey");

-- CreateIndex
CREATE INDEX "capsule_plays_linkId_createdAt_idx" ON "capsule_plays"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "capsule_plays_capsuleId_viewId_key" ON "capsule_plays"("capsuleId", "viewId");

-- CreateIndex
CREATE INDEX "voice_comments_linkId_createdAt_idx" ON "voice_comments"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "voice_comments_viewId_createdAt_idx" ON "voice_comments"("viewId", "createdAt");

-- AddForeignKey
ALTER TABLE "page_capsules" ADD CONSTRAINT "page_capsules_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_capsules" ADD CONSTRAINT "page_capsules_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capsule_plays" ADD CONSTRAINT "capsule_plays_capsuleId_fkey" FOREIGN KEY ("capsuleId") REFERENCES "page_capsules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capsule_plays" ADD CONSTRAINT "capsule_plays_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capsule_plays" ADD CONSTRAINT "capsule_plays_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "document_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_comments" ADD CONSTRAINT "voice_comments_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_comments" ADD CONSTRAINT "voice_comments_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "document_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_comments" ADD CONSTRAINT "voice_comments_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

