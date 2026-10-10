-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "mailClient" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- Sellers already on Clozer don't get the welcome tour on their next visit
INSERT INTO "notification_preferences" ("id", "userId", "organizationId", "onboardingCompletedAt", "updatedAt")
SELECT DISTINCT 'onb_' || md5("userId" || "organizationId"), "userId", "organizationId", NOW(), NOW()
FROM "members"
ON CONFLICT ("userId", "organizationId") DO UPDATE SET "onboardingCompletedAt" = NOW();
