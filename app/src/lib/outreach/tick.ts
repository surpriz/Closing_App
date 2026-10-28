import { captureException } from "@sentry/nextjs";

import { syncMailboxesDue } from "@/lib/mailboxes/inbound/sync";

import { finishIdleCampaigns } from "./campaigns";
import { outreachOrgIds } from "./flag";
import { planEnrollments } from "./plan";
import { evaluateReadingSignals } from "./reading";
import { budgetLeft, type OutreachScope } from "./scope";
import { expireStaleLeases, sendDueMessages } from "./sender";

const DEFAULT_SYNC_BUDGET_MS = 60_000;

// Each step is isolated: a failing inbox sync must not keep due emails from going out
async function step<T>(label: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    console.error(`[outreach:${label}]`, error);
    captureException(error, { tags: { outreach: label } });
    return null;
  }
}

/**
 * `deadline` (real clock) is when the caller must be done: the sync and the send budgets shrink to fit before it.
 * Only the beta workspaces of OUTREACH_ORG_IDS run: emptying the variable stops every send and sync at once.
 */
export async function runOutreachTick(
  now = new Date(),
  scope: { organizationId?: string; syncBudgetMs?: number; deadline?: Date } = {},
) {
  const organizationIds = outreachOrgIds();
  if (organizationIds.length === 0 || (scope.organizationId !== undefined && !organizationIds.includes(scope.organizationId))) {
    return { stale: null, synced: null, planned: null, sent: null, read: null, finished: null };
  }
  const base: OutreachScope = { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), organizationIds };

  const stale = await step("stale", () => expireStaleLeases(now, base));
  const budgetMs = budgetLeft(scope.syncBudgetMs ?? DEFAULT_SYNC_BUDGET_MS, scope.deadline);
  const synced = await step("sync", () => syncMailboxesDue(now, { budgetMs, ...base }));
  const planned = await step("plan", () => planEnrollments(now, base));
  const sent = await step("send", () => sendDueMessages(now, { ...base, ...(scope.deadline ? { deadline: scope.deadline } : {}) }));
  const read = await step("read", () => evaluateReadingSignals(now, { ...base, ...(scope.deadline ? { deadline: scope.deadline } : {}) }));
  const finished = await step("finish", () => finishIdleCampaigns(now, base));
  return { stale, synced, planned, sent, read, finished };
}
