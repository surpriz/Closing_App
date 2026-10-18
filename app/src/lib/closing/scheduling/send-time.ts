import { prisma } from "@/lib/db";

import type { BusinessHours } from "./business-hours";
import { habitualHour, MIN_PROSPECT_READINGS, MIN_WORKSPACE_READINGS } from "./send-slot";

export { nextSendSlot } from "./send-slot";

const WORKSPACE_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

/** The prospect's habitual reading hour, else the workspace's, else null. */
export async function habitualSendHour(input: {
  prospectId: string | null;
  organizationId: string;
  timeZone: string;
  hours: BusinessHours;
  now?: Date;
}) {
  if (input.prospectId) {
    const views = await prisma.documentView.findMany({
      where: { prospectId: input.prospectId, isBot: false },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: { startedAt: true },
    });
    const own = habitualHour(
      views.map((v) => ({ at: v.startedAt, timeZone: input.timeZone })),
      input.hours,
      MIN_PROSPECT_READINGS,
    );
    if (own !== null) return own;
  }
  const now = input.now ?? new Date();
  const views = await prisma.documentView.findMany({
    where: {
      isBot: false,
      timezone: { not: null },
      startedAt: { gte: new Date(now.getTime() - WORKSPACE_LOOKBACK_MS) },
      link: { organizationId: input.organizationId },
    },
    orderBy: { startedAt: "desc" },
    take: 500,
    select: { startedAt: true, timezone: true },
  });
  // Each reading in its reader's own time zone: 10 h in Paris and 10 h in Montreal are the same habit
  return habitualHour(
    views.map((v) => ({ at: v.startedAt, timeZone: v.timezone! })),
    input.hours,
    MIN_WORKSPACE_READINGS,
  );
}
