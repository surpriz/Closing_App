import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

function startOfUtcDay(now: Date) {
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

/**
 * Two ceilings on AI spend: analyses per workspace per day, and dollars per
 * day across all workspaces. Over either, the rule-based advice takes over.
 * The prospect assistant has its own budget (canChat): prospects chatting
 * must never starve the analyses.
 */
export async function canAnalyze(organizationId: string, now = new Date()) {
  const { AI_BRAIN_DAILY_LIMIT, AI_DAILY_BUDGET_USD } = getEnv();
  const since = startOfUtcDay(now);

  const [analyses, spend] = await Promise.all([
    prisma.dealInsight.count({ where: { organizationId, createdAt: { gte: since }, model: { not: null } } }),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: since }, purpose: { not: "chat" } }, _sum: { costMicroUsd: true } }),
  ]);
  if (analyses >= AI_BRAIN_DAILY_LIMIT) return false;
  return (spend._sum.costMicroUsd ?? 0) < AI_DAILY_BUDGET_USD * 1_000_000;
}

/** Ceilings for the prospect assistant, per workspace: one abused link must not switch it off elsewhere. */
export async function canChat(organizationId: string, now = new Date()) {
  const { AI_CHAT_DAILY_LIMIT, AI_CHAT_DAILY_BUDGET_USD } = getEnv();
  const since = startOfUtcDay(now);

  const [questions, spend] = await Promise.all([
    prisma.chatMessage.count({ where: { role: "USER", createdAt: { gte: since }, link: { organizationId } } }),
    prisma.aiUsage.aggregate({
      where: { organizationId, createdAt: { gte: since }, purpose: "chat" },
      _sum: { costMicroUsd: true },
    }),
  ]);
  if (questions >= AI_CHAT_DAILY_LIMIT) return false;
  return (spend._sum.costMicroUsd ?? 0) < AI_CHAT_DAILY_BUDGET_USD * 1_000_000;
}
