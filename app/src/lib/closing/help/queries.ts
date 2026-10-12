import { prisma } from "@/lib/db";

import type { StoredChatMessage } from "../chat/messages";

import { HELP_FEEDBACK_DAILY_MAX, HELP_HISTORY_MAX, HELP_HISTORY_WINDOW_MS } from "./constants";

const HOUR_MS = 60 * 60 * 1000;

/** The user's current conversation, oldest first: the last day of messages, at most HELP_HISTORY_MAX. */
export async function loadHelpHistory(
  userId: string,
  now: Date,
  take = HELP_HISTORY_MAX,
): Promise<StoredChatMessage[]> {
  const rows = await prisma.helpMessage.findMany({
    where: { userId, createdAt: { gte: new Date(now.getTime() - HELP_HISTORY_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, role: true, content: true, escalated: true },
  });
  return rows.reverse();
}

/** Questions the user asked in the last hour and the last day. */
export async function countRecentHelpQuestions(userId: string, now: Date) {
  const [lastHour, lastDay] = await Promise.all([
    prisma.helpMessage.count({ where: { userId, role: "USER", createdAt: { gte: new Date(now.getTime() - HOUR_MS) } } }),
    prisma.helpMessage.count({
      where: { userId, role: "USER", createdAt: { gte: new Date(now.getTime() - 24 * HOUR_MS) } },
    }),
  ]);
  return { lastHour, lastDay };
}

export async function canSendFeedback(userId: string, now: Date) {
  const sent = await prisma.helpFeedback.count({
    where: { userId, createdAt: { gte: new Date(now.getTime() - 24 * HOUR_MS) } },
  });
  return sent < HELP_FEEDBACK_DAILY_MAX;
}
