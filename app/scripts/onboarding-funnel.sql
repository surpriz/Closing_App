-- Getting-started funnel by signup week, read-only (Neon SQL editor or psql).
-- signup → tour opened → document → test read → tour done → real link sent → real prospect read
WITH sellers AS (
  SELECT m."userId", m."organizationId", m."createdAt" AS joined
  FROM members m
  WHERE m."createdAt" >= now() - interval '12 weeks'
)
SELECT
  date_trunc('week', s.joined)::date AS week,
  count(*) AS signups,
  count(p."onboardingStartedAt") AS tour_opened,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM documents d WHERE d."organizationId" = s."organizationId" AND d."ownerId" = s."userId"
  )) AS dropped_document,
  count(p."onboardingTestReadAt") AS saw_test_read,
  count(p."onboardingCompletedAt") AS tour_done,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM links l
    WHERE l."organizationId" = s."organizationId" AND l."createdById" = s."userId"
      AND l."draftAt" IS NULL AND NOT l."isOnboardingTest"
  )) AS sent_real_link,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM document_views v JOIN links l ON l.id = v."linkId"
    WHERE l."organizationId" = s."organizationId" AND l."createdById" = s."userId"
      AND NOT l."isOnboardingTest" AND NOT v."isBot"
  )) AS first_prospect_read
FROM sellers s
LEFT JOIN notification_preferences p
  ON p."userId" = s."userId" AND p."organizationId" = s."organizationId"
GROUP BY 1
ORDER BY 1 DESC;
