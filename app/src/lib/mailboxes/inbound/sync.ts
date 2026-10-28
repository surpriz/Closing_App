import type { Mailbox } from "@/generated/prisma/client";
import { ACTIVE_WORKSPACE } from "@/lib/closing/active-workspace";
import { DAY_MS, HOUR_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";
import { outreachOrgIds } from "@/lib/outreach/flag";
import { organizationWhere, type OutreachScope } from "@/lib/outreach/scope";

import { isMailboxError, MailboxError } from "../errors";
import { connectorFor } from "../index";
import { notifyMailboxOwner } from "../notify-owner";
import { maintainSubscriptions } from "../subscriptions";
import type { MailboxConnector } from "../types";

import { handleInbound, type InboundEffect } from "./handle";
import { normalizeMessageId, type MatchContext } from "./match";

export const SYNC_INTERVAL_MS = 5 * 60_000; // connectors without webhooks (IMAP)
export const SYNC_INTERVAL_WEBHOOK_MS = 15 * 60_000;
// Must stay >= the cron route's maxDuration (300 s): a lease that expires while its tick still runs would let a second
// tick replay the same `pending` inbox events concurrently
export const SYNC_LEASE_MS = 5 * 60_000;
export const SYNC_BUDGET_PER_MAILBOX_MS = 25_000;
export const MAX_SYNC_BACKOFF_MS = 2 * HOUR_MS;
export const MAX_MAILBOXES_PER_TICK = 20;
export const SUBSCRIPTIONS_BUDGET_MS = 10_000;
export const PAGE_LIMIT = 50;
/** Below this a connect + page cannot finish: the mailbox waits for the next tick instead of failing. */
export const MIN_SYNC_BUDGET_MS = 5_000;
export const LOOKBACK_MS = 7 * DAY_MS;
export const SENT_WINDOW_MS = 60 * DAY_MS;
/** A mailbox cut short by the end of the tick is looked at again soon, behind the others. */
const RETRY_SOON_MS = 60_000;
/** Consecutive failures (other than a revoked login) before the owner hears about it. */
const SYNC_FAILURES_BEFORE_NOTICE = 3;

type ConnectorMailbox = Pick<Mailbox, "id" | "provider" | "connector" | "email" | "displayName" | "credentials">;
export type SyncDeps = { connector?: (mailbox: ConnectorMailbox) => MailboxConnector };

const noEffects = (): Record<InboundEffect, number> => ({
  reply: 0,
  bounce: 0,
  bounce_transient: 0,
  bounce_policy: 0,
  ignored: 0,
  duplicate: 0,
});

/** One mailbox: read what arrived since the cursor, apply it, persist the cursor after every page. Null when not ACTIVE. */
export async function syncMailbox(
  mailboxId: string,
  now: Date,
  deps: SyncDeps & { budgetMs?: number } = {},
): Promise<{ pages: number; effects: Record<InboundEffect, number> } | null> {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: mailboxId },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      connector: true,
      email: true,
      displayName: true,
      credentials: true,
      status: true,
      timezone: true,
      createdAt: true,
      syncCursor: true,
      policyBounceDay: true,
      policyBounceCount: true,
    },
  });
  if (!mailbox || mailbox.status !== "ACTIVE") return null;

  const connector = (deps.connector ?? connectorFor)(mailbox);
  const ctx = await buildContext(mailbox, now);
  const candidateSenders = new Set(ctx.enrollments.map((e) => e.email.toLowerCase()));
  const notBefore = new Date(Math.max(mailbox.createdAt.getTime(), now.getTime() - LOOKBACK_MS));

  const budgetMs = deps.budgetMs ?? SYNC_BUDGET_PER_MAILBOX_MS;
  const deadline = Date.now() + budgetMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  const effects = noEffects();
  let pages = 0;
  let cursor = mailbox.syncCursor;
  try {
    for (;;) {
      let page;
      try {
        page = await connector.listNewMessages(cursor, {
          limit: PAGE_LIMIT,
          notBefore,
          signal: controller.signal,
          candidateSenders,
        });
      } catch (error) {
        // Out of time mid-page: what earlier pages stored stays, the next pass resumes from there
        if (controller.signal.aborted) break;
        throw error;
      }
      // A throw stops the page before its cursor is stored: the messages already handled come back as duplicates,
      // the failing one is retried (handleInbound marks it), and the caller applies the backoff
      for (const message of page.messages) effects[await handleInbound(mailbox, message, ctx, now)]++;
      pages++;
      cursor = page.cursor;
      await prisma.mailbox.update({ where: { id: mailbox.id }, data: { syncCursor: cursor } });
      if (!page.hasMore || controller.signal.aborted || Date.now() >= deadline) break;
    }
  } finally {
    clearTimeout(timer);
  }
  return { pages, effects };
}

async function buildContext(
  mailbox: { id: string; organizationId: string; email: string },
  now: Date,
): Promise<MatchContext> {
  const [members, sent, enrollments] = await Promise.all([
    prisma.member.findMany({ where: { organizationId: mailbox.organizationId }, select: { user: { select: { email: true } } } }),
    prisma.campaignMessage.findMany({
      where: {
        mailboxId: mailbox.id,
        status: "SENT",
        sentAt: { gte: new Date(now.getTime() - SENT_WINDOW_MS) },
        OR: [{ messageId: { not: null } }, { threadId: { not: null } }],
      },
      select: { id: true, enrollmentId: true, messageId: true, threadId: true },
    }),
    prisma.campaignProspect.findMany({
      where: { campaign: { mailboxId: mailbox.id }, status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } },
      select: {
        id: true,
        email: true,
        messages: { where: { status: "SENT" }, orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
      },
    }),
  ]);

  const sentMessageIds: MatchContext["sentMessageIds"] = new Map();
  const sentThreadIds: MatchContext["sentThreadIds"] = new Map();
  for (const m of sent) {
    const ref = { enrollmentId: m.enrollmentId, messageId: m.id };
    if (m.messageId) sentMessageIds.set(normalizeMessageId(m.messageId), ref);
    if (m.threadId) sentThreadIds.set(m.threadId, ref);
  }
  return {
    mailboxAddress: mailbox.email,
    teamEmails: members.map((m) => m.user.email),
    sentMessageIds,
    sentThreadIds,
    // Someone never written to cannot be answering: only enrollments with a sent message take part
    enrollments: enrollments.flatMap((e) =>
      e.messages[0]?.sentAt ? [{ enrollmentId: e.id, email: e.email, lastSentAt: e.messages[0].sentAt }] : [],
    ),
    now,
  };
}

/** The tick: due mailboxes one by one under a shared budget, each isolated so one failure never stops the rest. */
export async function syncMailboxesDue(
  now: Date,
  opts: { budgetMs: number } & Pick<OutreachScope, "organizationId" | "organizationIds"> & SyncDeps,
): Promise<{ synced: number; errors: number }> {
  const deadline = Date.now() + opts.budgetMs;
  // Push subscriptions first, on their own small budget: a slow Graph never eats the sync time
  try {
    await maintainSubscriptions(now, { ...opts, budgetMs: Math.min(SUBSCRIPTIONS_BUDGET_MS, opts.budgetMs) });
  } catch (error) {
    console.error("[mailbox-sync] subscriptions", error);
  }
  const due = await prisma.mailbox.findMany({
    where: {
      status: "ACTIVE",
      ...organizationWhere(opts),
      ...ACTIVE_WORKSPACE,
      // D13: nothing to look for in an inbox we never wrote from
      messages: { some: { status: "SENT", sentAt: { gte: new Date(now.getTime() - SENT_WINDOW_MS) } } },
      OR: [{ syncRequestedAt: { not: null } }, { nextSyncAt: null }, { nextSyncAt: { lte: now } }],
    },
    select: {
      id: true,
      provider: true,
      connector: true,
      email: true,
      displayName: true,
      credentials: true,
      syncErrorCount: true,
    },
    // Never-synced mailboxes first, or a backlog of due ones could starve them
    orderBy: [{ syncRequestedAt: "asc" }, { nextSyncAt: { sort: "asc", nulls: "first" } }],
    take: MAX_MAILBOXES_PER_TICK,
  });

  let synced = 0;
  let errors = 0;
  for (const mailbox of due) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_SYNC_BUDGET_MS) break;
    try {
      if (!(await claimSyncLease(mailbox.id, now))) continue;
    } catch (error) {
      console.error(`[mailbox-sync] ${mailbox.id} lease`, error);
      errors++;
      continue;
    }
    const outcome = await syncUnderLease(mailbox, now, Math.min(SYNC_BUDGET_PER_MAILBOX_MS, remaining), opts);
    if (outcome === "synced") synced++;
    else if (outcome === "failed") errors++;
  }
  return { synced, errors };
}

export type SyncNowOutcome = "skipped" | "busy" | "backoff" | "synced" | "failed" | "idle";

/**
 * A webhook asked for this mailbox: sync it now, under the same lease and kill switch as the tick, so a webhook pass
 * and a tick pass never replay the same inbound events. Held lease: the request is left in syncRequestedAt for the
 * holder or the next tick.
 */
export async function syncMailboxNow(
  mailboxId: string,
  now: Date,
  deps: SyncDeps & { budgetMs?: number } = {},
): Promise<{ outcome: SyncNowOutcome }> {
  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      status: "ACTIVE",
      ...organizationWhere({ organizationIds: outreachOrgIds() }),
      ...ACTIVE_WORKSPACE,
      messages: { some: { status: "SENT", sentAt: { gte: new Date(now.getTime() - SENT_WINDOW_MS) } } },
    },
    select: {
      id: true,
      provider: true,
      connector: true,
      email: true,
      displayName: true,
      credentials: true,
      syncErrorCount: true,
      nextSyncAt: true,
    },
  });
  if (!mailbox) return { outcome: "skipped" };
  const keepRequest = () => prisma.mailbox.updateMany({ where: { id: mailbox.id }, data: { syncRequestedAt: now } });
  // A failing mailbox keeps its backoff: every webhook retrying it would burn the failure count and warn the owner
  // over a short provider hiccup. The tick takes the request at nextSyncAt
  if (mailbox.syncErrorCount > 0 && mailbox.nextSyncAt && mailbox.nextSyncAt > now) {
    await keepRequest();
    return { outcome: "backoff" };
  }
  if (!(await claimSyncLease(mailbox.id, now))) {
    await keepRequest();
    return { outcome: "busy" };
  }
  return { outcome: await syncUnderLease(mailbox, now, deps.budgetMs ?? SYNC_BUDGET_PER_MAILBOX_MS, deps) };
}

/**
 * Takes the sync lease (free, or left stale by a crashed run). A pending webhook request is folded into this pass, so
 * one that arrives while it runs is kept for the next. False when someone else holds it.
 */
async function claimSyncLease(mailboxId: string, now: Date): Promise<boolean> {
  const lease = await prisma.mailbox.updateMany({
    where: {
      id: mailboxId,
      OR: [{ syncClaimedAt: null }, { syncClaimedAt: { lt: new Date(now.getTime() - SYNC_LEASE_MS) } }],
    },
    data: { syncClaimedAt: now, syncRequestedAt: null },
  });
  return lease.count > 0;
}

/** One leased mailbox: sync within the budget, then schedule the next pass or record the failure, and give the lease back. */
async function syncUnderLease(
  mailbox: ConnectorMailbox & { syncErrorCount: number },
  now: Date,
  budgetMs: number,
  deps: SyncDeps,
): Promise<"synced" | "failed" | "idle"> {
  try {
    const connector = (deps.connector ?? connectorFor)(mailbox);
    const result = await syncMailbox(mailbox.id, now, { connector: () => connector, budgetMs });
    if (!result) {
      await release(mailbox.id, now);
      return "idle";
    }
    if (result.pages === 0) {
      if (budgetMs >= SYNC_BUDGET_PER_MAILBOX_MS) {
        await recordFailure(mailbox.id, mailbox.syncErrorCount + 1, new MailboxError("TRANSIENT", "no page within budget"), now);
        return "failed";
      }
      await prisma.mailbox.updateMany({
        where: { id: mailbox.id, syncClaimedAt: now },
        data: { syncClaimedAt: null, nextSyncAt: new Date(now.getTime() + RETRY_SOON_MS) },
      });
      return "idle";
    }
    const interval = connector.capabilities.webhooks ? SYNC_INTERVAL_WEBHOOK_MS : SYNC_INTERVAL_MS;
    await prisma.mailbox.updateMany({
      where: { id: mailbox.id, syncClaimedAt: now },
      data: { lastSyncAt: now, nextSyncAt: new Date(now.getTime() + interval), syncErrorCount: 0, syncClaimedAt: null },
    });
    return "synced";
  } catch (error) {
    await recordFailure(mailbox.id, mailbox.syncErrorCount + 1, error, now);
    return "failed";
  }
}

/** Gives the lease back without touching the schedule; only if it is still ours. */
async function release(mailboxId: string, claimedAt: Date) {
  await prisma.mailbox.updateMany({ where: { id: mailboxId, syncClaimedAt: claimedAt }, data: { syncClaimedAt: null } });
}

async function recordFailure(mailboxId: string, failures: number, error: unknown, now: Date) {
  try {
    const code = isMailboxError(error) ? error.code : "TRANSIENT";
    const raw = isMailboxError(error) ? (error.options.detail ?? error.message) : error instanceof Error ? error.message : String(error);
    const detail = raw.slice(0, 300);
    const lastError = `${code}: ${detail}`;
    console.error(`[mailbox-sync] ${mailboxId}`, lastError);
    const backoff = Math.min(SYNC_INTERVAL_MS * 2 ** failures, MAX_SYNC_BACKOFF_MS);
    await prisma.mailbox.updateMany({
      where: { id: mailboxId, syncClaimedAt: now },
      data: {
        syncErrorCount: failures,
        nextSyncAt: new Date(now.getTime() + backoff),
        syncClaimedAt: null,
        lastError,
        lastErrorAt: now,
        ...(code === "AUTH_REVOKED" ? { status: "ERROR" as const } : {}),
      },
    });
    if (code === "AUTH_REVOKED") await notifyMailboxOwner(mailboxId, "auth_revoked", detail, now);
    else if (failures >= SYNC_FAILURES_BEFORE_NOTICE) await notifyMailboxOwner(mailboxId, "sync_failed", detail, now);
  } catch (inner) {
    console.error(`[mailbox-sync] ${mailboxId} failure bookkeeping`, inner);
  }
}
