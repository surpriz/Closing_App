import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

/**
 * Two ceilings on AI spend: analyses per workspace per day, and dollars per
 * day across all workspaces. Over either, the rule-based advice takes over.
 */
export async function canAnalyze(organizationId: string, now = new Date()) {
  const { AI_BRAIN_DAILY_LIMIT, AI_DAILY_BUDGET_USD } = getEnv();
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);

  const [analyses, spend] = await Promise.all([
    prisma.dealInsight.count({ where: { organizationId, createdAt: { gte: since }, model: { not: null } } }),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: since } }, _sum: { costMicroUsd: true } }),
  ]);
  if (analyses >= AI_BRAIN_DAILY_LIMIT) return false;
  return (spend._sum.costMicroUsd ?? 0) < AI_DAILY_BUDGET_USD * 1_000_000;
}
