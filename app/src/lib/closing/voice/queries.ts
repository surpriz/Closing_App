import { prisma } from "@/lib/db";

import { HOUR_MS } from "../constants";

/** Voice comments already sent, for the per-session, per-browser and per-network limits. */
export async function countRecentVoiceComments(input: {
  linkId: string;
  view: { id: string; visitorId: string; ipHash: string | null };
  now: Date;
}) {
  const hourAgo = new Date(input.now.getTime() - HOUR_MS);
  const dayStart = new Date(input.now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [viewLastHour, visitorToday, ipLastHour] = await Promise.all([
    prisma.voiceComment.count({ where: { viewId: input.view.id, createdAt: { gte: hourAgo } } }),
    prisma.voiceComment.count({
      where: { linkId: input.linkId, view: { visitorId: input.view.visitorId }, createdAt: { gte: dayStart } },
    }),
    input.view.ipHash
      ? prisma.voiceComment.count({ where: { view: { ipHash: input.view.ipHash }, createdAt: { gte: hourAgo } } })
      : 0,
  ]);
  return { viewLastHour, visitorToday, ipLastHour };
}
