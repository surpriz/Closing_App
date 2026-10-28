import type { Mailbox } from "@/generated/prisma/client";
import { ACTIVE_WORKSPACE } from "@/lib/closing/active-workspace";
import { prisma } from "@/lib/db";
import { organizationWhere, type OutreachScope } from "@/lib/outreach/scope";

import { isMailboxError } from "./errors";
import { connectorFor } from "./index";
import { notifyMailboxOwner } from "./notify-owner";
import type { MailboxConnector } from "./types";
import { mailboxWebhooksEnabled, mailboxWebhookUrl } from "./config";
import { RENEW_BEFORE_MS, subscriptionNeedsRenewal } from "./microsoft/subscriptions";
import { clientStateFor } from "./webhooks/token";

export const MAX_SUBSCRIPTIONS_PER_TICK = 20;
/** Past this the tick moves on: subscriptions are retried on the next one. */
const MIN_SUBSCRIPTION_BUDGET_MS = 1_000;

type SubscriptionMailbox = Pick<
  Mailbox,
  "id" | "provider" | "connector" | "email" | "displayName" | "credentials" | "subscriptionId" | "subscriptionExpiresAt"
>;
export type SubscriptionDeps = { connector?: (mailbox: SubscriptionMailbox) => MailboxConnector };

const isGone = (error: unknown) => isMailboxError(error) && /\b404\b/.test(error.options.detail ?? "");

/**
 * Keeps push subscriptions alive for connectors that have them (Graph): creates the missing ones, renews those inside
 * the renewal window, recreates one Graph no longer knows. A revoked login parks the mailbox like a failed sync.
 * Anything else is left for the next tick; the poll still covers the mailbox meanwhile.
 */
export async function maintainSubscriptions(
  now: Date,
  opts: { budgetMs: number } & Pick<OutreachScope, "organizationId" | "organizationIds"> & SubscriptionDeps,
): Promise<{ subscribed: number; renewed: number; errors: number }> {
  const result = { subscribed: 0, renewed: 0, errors: 0 };
  if (!mailboxWebhooksEnabled()) return result;

  const deadline = Date.now() + opts.budgetMs;
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: "ACTIVE",
      connector: "GRAPH",
      ...organizationWhere(opts),
      ...ACTIVE_WORKSPACE,
      OR: [
        { subscriptionId: null },
        { subscriptionExpiresAt: null },
        { subscriptionExpiresAt: { lte: new Date(now.getTime() + RENEW_BEFORE_MS) } },
      ],
    },
    select: {
      id: true,
      provider: true,
      connector: true,
      email: true,
      displayName: true,
      credentials: true,
      subscriptionId: true,
      subscriptionExpiresAt: true,
    },
    orderBy: { subscriptionExpiresAt: { sort: "asc", nulls: "first" } },
    take: MAX_SUBSCRIPTIONS_PER_TICK,
  });

  for (const mailbox of mailboxes) {
    if (deadline - Date.now() < MIN_SUBSCRIPTION_BUDGET_MS) break;
    try {
      const connector = (opts.connector ?? connectorFor)(mailbox);
      if (!connector.capabilities.webhooks || !connector.subscribe) continue;

      if (mailbox.subscriptionId) {
        if (!subscriptionNeedsRenewal(mailbox.subscriptionExpiresAt, now)) continue;
        if (!connector.renew) continue;
        try {
          const { expiresAt } = await connector.renew(mailbox.subscriptionId);
          await prisma.mailbox.update({ where: { id: mailbox.id }, data: { subscriptionExpiresAt: expiresAt } });
          result.renewed++;
          continue;
        } catch (error) {
          if (!isGone(error)) throw error;
          // Graph dropped it: fall through to a fresh subscription
        }
      }

      const sub = await connector.subscribe({ notificationUrl: mailboxWebhookUrl("microsoft"), clientState: clientStateFor(mailbox.id) });
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { subscriptionId: sub.subscriptionId, subscriptionExpiresAt: sub.expiresAt },
      });
      result.subscribed++;
    } catch (error) {
      result.errors++;
      await recordSubscriptionFailure(mailbox.id, error, now);
    }
  }
  return result;
}

async function recordSubscriptionFailure(mailboxId: string, error: unknown, now: Date) {
  try {
    const code = isMailboxError(error) ? error.code : "TRANSIENT";
    const raw = isMailboxError(error) ? (error.options.detail ?? error.message) : error instanceof Error ? error.message : String(error);
    const detail = raw.slice(0, 300);
    console.error(`[mailbox-subscription] ${mailboxId}`, `${code}: ${detail}`);
    if (code !== "AUTH_REVOKED") return;
    const { count } = await prisma.mailbox.updateMany({
      where: { id: mailboxId, status: "ACTIVE" },
      data: { status: "ERROR", lastError: `AUTH_REVOKED: ${detail}`, lastErrorAt: now },
    });
    if (count > 0) await notifyMailboxOwner(mailboxId, "auth_revoked", detail, now);
  } catch (inner) {
    console.error(`[mailbox-subscription] ${mailboxId} failure bookkeeping`, inner);
  }
}
