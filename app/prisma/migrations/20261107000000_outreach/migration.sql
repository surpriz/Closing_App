-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'IMAP');

-- CreateEnum
CREATE TYPE "MailboxConnector" AS ENUM ('UNIPILE', 'NYLAS', 'GRAPH', 'SMTP');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('CONNECTING', 'ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('QUEUED', 'ACTIVE', 'PAUSED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'SUPPRESSED', 'FINISHED', 'STOPPED');

-- CreateEnum
CREATE TYPE "CampaignMessageKind" AS ENUM ('STEP', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "CampaignMessageStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('UNSUBSCRIBE', 'BOUNCE', 'COMPLAINT', 'MANUAL');

-- CreateEnum
CREATE TYPE "MailboxInboundKind" AS ENUM ('REPLY', 'BOUNCE', 'IGNORED');

-- AlterEnum
ALTER TYPE "FollowupSentVia" ADD VALUE 'MAILBOX';

-- AlterEnum
ALTER TYPE "ActivitySource" ADD VALUE 'MAILBOX';

-- AlterEnum
ALTER TYPE "ProspectOrigin" ADD VALUE 'CAMPAIGN';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "mailboxQuantity" INTEGER;

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "campaignOwned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "campaignProspectId" TEXT;

-- AlterTable
ALTER TABLE "followups_queue" ADD COLUMN     "campaignProspectId" TEXT;

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL,
    "connector" "MailboxConnector" NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "displayName" TEXT,
    "signature" TEXT,
    "credentials" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "status" "MailboxStatus" NOT NULL DEFAULT 'CONNECTING',
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "errorNotifiedAt" TIMESTAMP(3),
    "dailyCap" INTEGER NOT NULL DEFAULT 30,
    "rampStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL,
    "sentDay" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "policyBounceDay" TEXT,
    "policyBounceCount" INTEGER NOT NULL DEFAULT 0,
    "spfOk" BOOLEAN,
    "dkimOk" BOOLEAN,
    "dmarcOk" BOOLEAN,
    "dkimSelector" TEXT,
    "dnsDetail" JSONB,
    "dnsCheckedAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "syncRequestedAt" TIMESTAMP(3),
    "syncClaimedAt" TIMESTAMP(3),
    "syncErrorCount" INTEGER NOT NULL DEFAULT 0,
    "subscriptionId" TEXT,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "webhookSecret" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_oauth_states" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL,
    "codeVerifier" TEXT,
    "redirectTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_inbound_events" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "kind" "MailboxInboundKind" NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "fromEmail" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "excerpt" TEXT,
    "dsnStatus" TEXT,
    "dsnClass" TEXT,
    "matchedMessageId" TEXT,
    "enrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_inbound_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "documentId" TEXT,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "locale" TEXT NOT NULL,
    "linkOnReply" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_steps" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 3,
    "subject" TEXT,
    "newThread" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "carriesLink" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_prospects" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "title" TEXT,
    "vars" JSONB,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "threadSubject" TEXT,
    "firstMessageId" TEXT,
    "providerThreadId" TEXT,
    "linkId" TEXT,
    "prospectId" TEXT,
    "readEvaluatedAt" TIMESTAMP(3),
    "lastSignal" TEXT,
    "reactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_messages" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "stepId" TEXT,
    "followupId" TEXT,
    "kind" "CampaignMessageKind" NOT NULL DEFAULT 'STEP',
    "status" "CampaignMessageStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sendingAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "messageId" TEXT,
    "providerMessageId" TEXT,
    "inReplyTo" TEXT,
    "threadId" TEXT,
    "carriesLink" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT NOT NULL,
    "bouncedAt" TIMESTAMP(3),
    "bounceDetail" TEXT,
    "repliedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "source" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailboxes_status_nextSyncAt_idx" ON "mailboxes"("status", "nextSyncAt");

-- CreateIndex
CREATE INDEX "mailboxes_userId_idx" ON "mailboxes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_organizationId_email_key" ON "mailboxes"("organizationId", "email");

-- CreateIndex
CREATE INDEX "mailbox_oauth_states_expiresAt_idx" ON "mailbox_oauth_states"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_inbound_events_externalKey_key" ON "mailbox_inbound_events"("externalKey");

-- CreateIndex
CREATE INDEX "mailbox_inbound_events_mailboxId_receivedAt_idx" ON "mailbox_inbound_events"("mailboxId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "campaigns_organizationId_status_idx" ON "campaigns"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_steps_campaignId_order_key" ON "campaign_steps"("campaignId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_prospects_linkId_key" ON "campaign_prospects"("linkId");

-- CreateIndex
CREATE INDEX "campaign_prospects_status_nextSendAt_idx" ON "campaign_prospects"("status", "nextSendAt");

-- CreateIndex
CREATE INDEX "campaign_prospects_organizationId_email_idx" ON "campaign_prospects"("organizationId", "email");

-- CreateIndex
CREATE INDEX "campaign_prospects_campaignId_status_idx" ON "campaign_prospects"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_prospects_campaignId_email_key" ON "campaign_prospects"("campaignId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_messages_followupId_key" ON "campaign_messages"("followupId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_messages_dedupeKey_key" ON "campaign_messages"("dedupeKey");

-- CreateIndex
CREATE INDEX "campaign_messages_status_scheduledFor_idx" ON "campaign_messages"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "campaign_messages_mailboxId_status_sentAt_idx" ON "campaign_messages"("mailboxId", "status", "sentAt");

-- CreateIndex
CREATE INDEX "campaign_messages_enrollmentId_createdAt_idx" ON "campaign_messages"("enrollmentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "campaign_messages_messageId_idx" ON "campaign_messages"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "suppressions_organizationId_email_key" ON "suppressions"("organizationId", "email");

-- CreateIndex
CREATE INDEX "links_campaignProspectId_idx" ON "links"("campaignProspectId");

-- CreateIndex
CREATE INDEX "links_campaignOwned_idx" ON "links"("campaignOwned");

-- CreateIndex
CREATE INDEX "followups_queue_campaignProspectId_idx" ON "followups_queue"("campaignProspectId");

-- AddForeignKey
ALTER TABLE "followups_queue" ADD CONSTRAINT "followups_queue_campaignProspectId_fkey" FOREIGN KEY ("campaignProspectId") REFERENCES "campaign_prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_inbound_events" ADD CONSTRAINT "mailbox_inbound_events_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_steps" ADD CONSTRAINT "campaign_steps_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "campaign_prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "followups_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

