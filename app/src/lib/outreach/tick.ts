import { captureException } from "@sentry/nextjs";

import { syncMailboxesDue } from "@/lib/mailboxes/inbound/sync";

import { finishIdleCampaigns } from "./campaigns";
import { planEnrollments } from "./plan";
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

export async function runOutreachTick(
  now = new Date(),
  scope: { organizationId?: string; syncBudgetMs?: number } = {},
) {
  const stale = await step("stale", () => expireStaleLeases(now));
  const budgetMs = scope.syncBudgetMs ?? DEFAULT_SYNC_BUDGET_MS;
  const synced = await step("sync", () => syncMailboxesDue(now, { budgetMs, organizationId: scope.organizationId }));
  const planned = await step("plan", () => planEnrollments(now, scope));
  const sent = await step("send", () => sendDueMessages(now, scope));
  const finished = await step("finish", () => finishIdleCampaigns(now, scope));
  return { stale, synced, planned, sent, finished };
}
