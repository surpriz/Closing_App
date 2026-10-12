-- CreateEnum
CREATE TYPE "HelpFeedbackKind" AS ENUM ('SUGGESTION', 'BUG', 'QUESTION', 'OTHER');

-- CreateTable
CREATE TABLE "help_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "pathname" TEXT,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_feedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "HelpFeedbackKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "pathname" TEXT,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_messages_userId_createdAt_idx" ON "help_messages"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "help_messages_organizationId_createdAt_idx" ON "help_messages"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "help_feedback_createdAt_idx" ON "help_feedback"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "help_feedback_userId_idx" ON "help_feedback"("userId");

-- AddForeignKey
ALTER TABLE "help_messages" ADD CONSTRAINT "help_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_messages" ADD CONSTRAINT "help_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
