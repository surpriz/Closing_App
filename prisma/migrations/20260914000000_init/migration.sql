-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PageTag" AS ENUM ('PRICING', 'TERMS', 'TIMELINE', 'SCOPE', 'TEAM', 'CASE_STUDY', 'OTHER');

-- CreateEnum
CREATE TYPE "PageTagSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'VALIDATED', 'CHANGE_REQUESTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "FollowupChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "FollowupTrigger" AS ENUM ('HOT_PRICING', 'ANTI_GHOSTING', 'MANUAL');

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('PENDING', 'GENERATED', 'SCHEDULED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EngagementTier" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "SellerAlertType" AS ENUM ('MULTI_VIEWER', 'REOPENED_AFTER_INACTIVITY');

-- CreateEnum
CREATE TYPE "SellerAlertChannel" AS ENUM ('EMAIL', 'SLACK', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "ProspectActionType" AS ENUM ('VALIDATE_SIGN', 'REQUEST_CHANGE');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,
    "stripeCustomerId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultChannels" "FollowupChannel"[] DEFAULT ARRAY['EMAIL']::"FollowupChannel"[],
    "hotPricingThresholdSec" INTEGER NOT NULL DEFAULT 90,
    "inactivityDays" INTEGER[] DEFAULT ARRAY[3, 5]::INTEGER[],
    "businessHourStart" INTEGER NOT NULL DEFAULT 9,
    "businessHourEnd" INTEGER NOT NULL DEFAULT 18,
    "businessDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "multiViewerThreshold" INTEGER NOT NULL DEFAULT 2,
    "reopenAfterInactivityDays" INTEGER NOT NULL DEFAULT 3,
    "chatEnabledByDefault" BOOLEAN NOT NULL DEFAULT false,
    "alertChannels" "SellerAlertChannel"[] DEFAULT ARRAY['EMAIL']::"SellerAlertChannel"[],
    "alertEmail" TEXT,
    "slackWebhookUrl" TEXT,
    "outboundWebhookUrl" TEXT,
    "webhookSecret" TEXT,
    "aiTone" TEXT,
    "senderName" TEXT,
    "senderSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "numPages" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT,
    "summary" TEXT,
    "tags" "PageTag"[],
    "tagSource" "PageTagSource" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT,
    "requireEmail" BOOLEAN NOT NULL DEFAULT true,
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "dealStatus" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ctaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "followupsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" "FollowupChannel"[],
    "hotPricingThresholdSec" INTEGER,
    "inactivityDays" INTEGER[],
    "businessHourStart" INTEGER,
    "businessHourEnd" INTEGER,
    "sentAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "phoneE164" TEXT,
    "whatsappOptInAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "locale" TEXT,
    "timezone" TEXT,
    "country" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_views" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "prospectId" TEXT,
    "visitorId" TEXT NOT NULL,
    "email" TEXT,
    "ipHash" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "locale" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "maxPageReached" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "maxScrollDepth" DOUBLE PRECISION,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_scores" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "tier" "EngagementTier" NOT NULL DEFAULT 'COLD',
    "uniqueViewers" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "reasons" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followups_queue" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "trigger" "FollowupTrigger" NOT NULL,
    "channel" "FollowupChannel" NOT NULL,
    "status" "FollowupStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "context" JSONB,
    "subject" TEXT,
    "body" TEXT,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "triggerRunId" TEXT,
    "providerMessageId" TEXT,
    "error" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followups_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_alerts" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "type" "SellerAlertType" NOT NULL,
    "channels" "SellerAlertChannel"[],
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_actions" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewId" TEXT,
    "prospectId" TEXT,
    "type" "ProspectActionType" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "members_organizationId_idx" ON "members"("organizationId");

-- CreateIndex
CREATE INDEX "members_userId_idx" ON "members"("userId");

-- CreateIndex
CREATE INDEX "invitations_organizationId_idx" ON "invitations"("organizationId");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_organizationId_key" ON "workspace_settings"("organizationId");

-- CreateIndex
CREATE INDEX "documents_organizationId_createdAt_idx" ON "documents"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "document_pages_documentId_pageNumber_key" ON "document_pages"("documentId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "links_slug_key" ON "links"("slug");

-- CreateIndex
CREATE INDEX "links_organizationId_createdAt_idx" ON "links"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "links_documentId_idx" ON "links"("documentId");

-- CreateIndex
CREATE INDEX "links_dealStatus_followupsEnabled_idx" ON "links"("dealStatus", "followupsEnabled");

-- CreateIndex
CREATE INDEX "prospects_email_idx" ON "prospects"("email");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_linkId_email_key" ON "prospects"("linkId", "email");

-- CreateIndex
CREATE INDEX "document_views_linkId_lastSeenAt_idx" ON "document_views"("linkId", "lastSeenAt" DESC);

-- CreateIndex
CREATE INDEX "document_views_linkId_visitorId_idx" ON "document_views"("linkId", "visitorId");

-- CreateIndex
CREATE INDEX "document_views_documentId_idx" ON "document_views"("documentId");

-- CreateIndex
CREATE INDEX "page_views_linkId_pageNumber_idx" ON "page_views"("linkId", "pageNumber");

-- CreateIndex
CREATE INDEX "page_views_linkId_lastSeenAt_idx" ON "page_views"("linkId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "page_views_viewId_pageNumber_key" ON "page_views"("viewId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "engagement_scores_linkId_key" ON "engagement_scores"("linkId");

-- CreateIndex
CREATE INDEX "engagement_scores_tier_idx" ON "engagement_scores"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "followups_queue_dedupeKey_key" ON "followups_queue"("dedupeKey");

-- CreateIndex
CREATE INDEX "followups_queue_status_scheduledFor_idx" ON "followups_queue"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "followups_queue_linkId_createdAt_idx" ON "followups_queue"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "followups_queue_prospectId_idx" ON "followups_queue"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_alerts_dedupeKey_key" ON "seller_alerts"("dedupeKey");

-- CreateIndex
CREATE INDEX "seller_alerts_linkId_createdAt_idx" ON "seller_alerts"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "prospect_actions_linkId_createdAt_idx" ON "prospect_actions"("linkId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_viewId_createdAt_idx" ON "chat_messages"("viewId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_linkId_idx" ON "chat_messages"("linkId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_views" ADD CONSTRAINT "document_views_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_views" ADD CONSTRAINT "document_views_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "document_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_scores" ADD CONSTRAINT "engagement_scores_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups_queue" ADD CONSTRAINT "followups_queue_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups_queue" ADD CONSTRAINT "followups_queue_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_alerts" ADD CONSTRAINT "seller_alerts_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_actions" ADD CONSTRAINT "prospect_actions_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_actions" ADD CONSTRAINT "prospect_actions_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "document_views"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_actions" ADD CONSTRAINT "prospect_actions_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "document_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;
