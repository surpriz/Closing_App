-- AlterTable
ALTER TABLE "links" ADD COLUMN     "isOnboardingTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "onboardingEmailsOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStartedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingTestReadAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "onboarding_emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_emails_userId_organizationId_kind_key" ON "onboarding_emails"("userId", "organizationId", "kind");

-- AddForeignKey
ALTER TABLE "onboarding_emails" ADD CONSTRAINT "onboarding_emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_emails" ADD CONSTRAINT "onboarding_emails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Members who signed up before the welcome emails existed never get them
INSERT INTO "onboarding_emails" ("id", "userId", "organizationId", "kind")
SELECT 'legacy_' || m."id" || '_' || k.kind, m."userId", m."organizationId", k.kind
FROM "members" m
CROSS JOIN (VALUES ('welcome'), ('no_document'), ('not_sent'), ('first_read')) AS k(kind);
