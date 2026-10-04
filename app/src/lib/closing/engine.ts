import { prisma } from "@/lib/db";

import { analyzePendingDeals } from "./brain/analyze-deal";
import { readPendingDocuments } from "./documents/read-pages";
import { refreshEngagementScore } from "./engagement/refresh-score";
import { dispatchDueFollowups } from "./followups/dispatch";
import { generateFollowupMessage } from "./followups/queue";
import { scanAntiGhosting } from "./triggers/anti-ghosting";

const STALE_PENDING_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// Recency points drop at 24 h, 3 days and 7 days after the last reading
const SCORE_DECAY_WINDOW_MS = 8 * 24 * HOUR_MS;

// Scores only change on tracking events; recompute them so recency decays
export async function refreshStaleScores(now = new Date()) {
  const stale = await prisma.engagementScore.findMany({
    where: {
      computedAt: { lte: new Date(now.getTime() - HOUR_MS) },
      link: {
        archivedAt: null,
        dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] },
        views: { some: { isBot: false, lastSeenAt: { gte: new Date(now.getTime() - SCORE_DECAY_WINDOW_MS) } } },
      },
    },
    select: { linkId: true },
    orderBy: { computedAt: "asc" },
    take: 50,
  });
  for (const { linkId } of stale) {
    await refreshEngagementScore(linkId, now);
  }
  return stale.length;
}

// One pass of the background engine. Called every few minutes by Trigger.dev
// (or any cron) through /api/cron/closing.
export async function runClosingTick(now = new Date()) {
  const antiGhostingQueued = await scanAntiGhosting(now);

  // Messages whose generation crashed or timed out after being queued
  const stale = await prisma.followup.findMany({
    where: { status: "PENDING", createdAt: { lte: new Date(now.getTime() - STALE_PENDING_MS) } },
    select: { id: true },
    take: 20,
  });
  for (const { id } of stale) {
    await generateFollowupMessage(id);
  }

  const dispatched = await dispatchDueFollowups(now);
  const rescored = await refreshStaleScores(now);
  const documentsRead = await readPendingDocuments(now);
  // Scores first: the analysis reads them
  const dealsAnalyzed = await analyzePendingDeals(now);
  return { antiGhostingQueued, regenerated: stale.length, dispatched, rescored, documentsRead, dealsAnalyzed };
}
