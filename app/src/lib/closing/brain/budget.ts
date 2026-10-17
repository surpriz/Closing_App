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
 * The prospect assistant, the help assistant and translations have their own
 * budgets (canChat, canHelp, canTranslate), and voice comments are transcribed whatever this says:
 * neither prospects nor help questions must starve the analyses.
 */
export async function canAnalyze(organizationId: string, now = new Date()) {
  const { AI_BRAIN_DAILY_LIMIT, AI_DAILY_BUDGET_USD } = getEnv();
  const since = startOfUtcDay(now);

  const [analyses, spend] = await Promise.all([
    prisma.dealInsight.count({ where: { organizationId, createdAt: { gte: since }, model: { not: null } } }),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: since }, purpose: { notIn: ["chat", "transcribe", "help", "translate"] } }, _sum: { costMicroUsd: true } }),
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

/** Ceiling for the help assistant, across all workspaces: users asking about Clozer is our cost, not theirs. */
export async function canHelp(now = new Date()) {
  const { AI_HELP_DAILY_BUDGET_USD } = getEnv();
  const spend = await prisma.aiUsage.aggregate({
    where: { createdAt: { gte: startOfUtcDay(now) }, purpose: "help" },
    _sum: { costMicroUsd: true },
  });
  return (spend._sum.costMicroUsd ?? 0) < AI_HELP_DAILY_BUDGET_USD * 1_000_000;
}

/** Ceiling for documents translated for readers, per workspace. */
export async function canTranslate(organizationId: string, now = new Date()) {
  const { AI_TRANSLATE_DAILY_BUDGET_USD } = getEnv();
  const spend = await prisma.aiUsage.aggregate({
    where: { organizationId, createdAt: { gte: startOfUtcDay(now) }, purpose: "translate" },
    _sum: { costMicroUsd: true },
  });
  return (spend._sum.costMicroUsd ?? 0) < AI_TRANSLATE_DAILY_BUDGET_USD * 1_000_000;
}
