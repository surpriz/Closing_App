-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "contentSha256" TEXT;

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "extension_tokens" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_tokens_tokenHash_key" ON "extension_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "extension_tokens_userId_idx" ON "extension_tokens"("userId");

-- CreateIndex
CREATE INDEX "documents_organizationId_contentSha256_idx" ON "documents"("organizationId", "contentSha256");

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
