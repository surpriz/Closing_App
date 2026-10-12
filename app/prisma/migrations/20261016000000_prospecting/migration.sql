-- CreateEnum
CREATE TYPE "TargetOrigin" AS ENUM ('MANUAL', 'INFERRED');

-- CreateEnum
CREATE TYPE "ProspectingProvider" AS ENUM ('APOLLO', 'LEMLIST', 'MOCK');

-- CreateEnum
CREATE TYPE "ProspectingRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'REVEALING', 'READY', 'INVALID', 'REJECTED');

-- CreateEnum
CREATE TYPE "SuggestionInvalidReason" AS ENUM ('NOT_FOUND', 'UNVERIFIED', 'PERSONAL', 'DUPLICATE', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "OptOutKind" AS ENUM ('EMAIL', 'LINKEDIN', 'PROVIDER_ID');

-- CreateEnum
CREATE TYPE "CreditEntryKind" AS ENUM ('SEARCH', 'REVEAL', 'DELIVERED');

-- AlterEnum
ALTER TYPE "ProspectOrigin" ADD VALUE 'PROSPECTING';

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "referenceConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "target_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "origin" "TargetOrigin" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nafCodes" TEXT[],
    "keywords" TEXT[],
    "headcountCodes" TEXT[],
    "regions" TEXT[],
    "departements" TEXT[],
    "jobTitles" TEXT[],
    "seniorities" TEXT[],
    "excludedDomains" TEXT[],
    "inferredEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetProfileId" TEXT NOT NULL,
    "provider" "ProspectingProvider" NOT NULL,
    "status" "ProspectingRunStatus" NOT NULL DEFAULT 'RUNNING',
    "comparisonId" TEXT,
    "filtersSnapshot" JSONB NOT NULL,
    "found" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "prospecting_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_suggestions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provider" "ProspectingProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceFetchedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastNameMasked" TEXT,
    "title" TEXT,
    "seniority" TEXT,
    "companyName" TEXT,
    "companyDomain" TEXT,
    "companySiren" TEXT,
    "nafVerified" BOOLEAN,
    "linkedinUrl" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "invalidReason" "SuggestionInvalidReason",
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "emailStatus" TEXT,
    "revealJobId" TEXT,
    "revealAttempts" INTEGER NOT NULL DEFAULT 0,
    "revealStartedAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),
    "linkId" TEXT,
    "hookSubject" TEXT,
    "hookBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_opt_outs" (
    "id" TEXT NOT NULL,
    "kind" "OptOutKind" NOT NULL,
    "valueHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospecting_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_credit_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ProspectingProvider" NOT NULL,
    "kind" "CreditEntryKind" NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "suggestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospecting_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_lookups" (
    "key" TEXT NOT NULL,
    "siren" TEXT,
    "name" TEXT,
    "naf" TEXT,
    "headcountCode" TEXT,
    "departement" TEXT,
    "region" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_lookups_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "target_profiles_organizationId_active_idx" ON "target_profiles"("organizationId", "active");

-- CreateIndex
CREATE INDEX "prospecting_runs_organizationId_startedAt_idx" ON "prospecting_runs"("organizationId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "prospecting_runs_comparisonId_idx" ON "prospecting_runs"("comparisonId");

-- CreateIndex
CREATE INDEX "prospect_suggestions_organizationId_status_idx" ON "prospect_suggestions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "prospect_suggestions_organizationId_dedupeKey_idx" ON "prospect_suggestions"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "prospect_suggestions_status_revealStartedAt_idx" ON "prospect_suggestions"("status", "revealStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_suggestions_organizationId_provider_externalId_key" ON "prospect_suggestions"("organizationId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "prospecting_opt_outs_kind_valueHash_key" ON "prospecting_opt_outs"("kind", "valueHash");

-- CreateIndex
CREATE INDEX "prospecting_credit_entries_organizationId_createdAt_idx" ON "prospecting_credit_entries"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "target_profiles" ADD CONSTRAINT "target_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecting_runs" ADD CONSTRAINT "prospecting_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecting_runs" ADD CONSTRAINT "prospecting_runs_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "target_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_suggestions" ADD CONSTRAINT "prospect_suggestions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_suggestions" ADD CONSTRAINT "prospect_suggestions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "prospecting_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecting_credit_entries" ADD CONSTRAINT "prospecting_credit_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

