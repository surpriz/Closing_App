-- Run once right after the billing deploy (Neon SQL editor or psql). Idempotent.
-- The migration runs before the new build is live: a workspace created by the old code in
-- between has neither a trial nor the beta flag. It signed up during the beta, so it gets the beta grace.
UPDATE organizations SET "betaGrace" = true
WHERE NOT "betaGrace" AND "trialEndsAt" IS NULL AND "planStatus" IS NULL;
