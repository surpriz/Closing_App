-- The seller closed the banner about the Chrome extension: hidden for a week
ALTER TABLE "notification_preferences" ADD COLUMN "extensionNudgeHiddenAt" TIMESTAMP(3);
