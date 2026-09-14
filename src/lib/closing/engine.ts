import { prisma } from "@/lib/db";

import { dispatchDueFollowups } from "./followups/dispatch";
import { generateFollowupMessage } from "./followups/queue";
import { scanAntiGhosting } from "./triggers/anti-ghosting";

const STALE_PENDING_MS = 5 * 60 * 1000;

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
  return { antiGhostingQueued, regenerated: stale.length, dispatched };
}
