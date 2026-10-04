import { prisma } from "@/lib/db";

/**
 * Test helper: pretends `days` passed for one deal by moving every date of it
 * back. Reading sessions, follow-ups, analyses, the decision deadline: all
 * keep their spacing, the deal simply looks older. Test tools only.
 */
export async function shiftLinkBack(linkId: string, days: number) {
  const d = Math.max(1, Math.min(60, Math.round(days)));
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "links" SET
      "createdAt" = "createdAt" - make_interval(days => ${d}::int),
      "sentAt" = "sentAt" - make_interval(days => ${d}::int),
      "lastActivityAt" = "lastActivityAt" - make_interval(days => ${d}::int),
      "decisionDeadline" = "decisionDeadline" - make_interval(days => ${d}::int),
      "snoozedUntil" = "snoozedUntil" - make_interval(days => ${d}::int)
      WHERE "id" = ${linkId}`,
    prisma.$executeRaw`UPDATE "document_views" SET
      "startedAt" = "startedAt" - make_interval(days => ${d}::int),
      "lastSeenAt" = "lastSeenAt" - make_interval(days => ${d}::int),
      "leftAt" = "leftAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "page_views" SET
      "firstSeenAt" = "firstSeenAt" - make_interval(days => ${d}::int),
      "lastSeenAt" = "lastSeenAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "prospects" SET
      "firstSeenAt" = "firstSeenAt" - make_interval(days => ${d}::int),
      "lastSeenAt" = "lastSeenAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "prospect_actions" SET "createdAt" = "createdAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "followups_queue" SET
      "createdAt" = "createdAt" - make_interval(days => ${d}::int),
      "scheduledFor" = "scheduledFor" - make_interval(days => ${d}::int),
      "sentAt" = "sentAt" - make_interval(days => ${d}::int),
      "approvedAt" = "approvedAt" - make_interval(days => ${d}::int),
      "editedAt" = "editedAt" - make_interval(days => ${d}::int),
      "cancelledAt" = "cancelledAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "seller_activities" SET
      "occurredAt" = "occurredAt" - make_interval(days => ${d}::int),
      "createdAt" = "createdAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "seller_alerts" SET "createdAt" = "createdAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "deal_insights" SET "createdAt" = "createdAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
    prisma.$executeRaw`UPDATE "engagement_scores" SET "computedAt" = "computedAt" - make_interval(days => ${d}::int)
      WHERE "linkId" = ${linkId}`,
  ]);
}
