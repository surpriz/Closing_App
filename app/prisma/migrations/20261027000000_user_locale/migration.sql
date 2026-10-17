-- Seller UI language. Everyone signed up so far used the French-only app.
ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
UPDATE "users" SET "locale" = 'fr';
