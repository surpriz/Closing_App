import type { Mailbox } from "@/generated/prisma/client";
import { ACTIVE_WORKSPACE } from "@/lib/closing/active-workspace";
import { DAY_MS, HOUR_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";

import { isMailboxError } from "../errors";
import { connectorFor } from "../index";
import { notifyMailboxOwner } from "../notify-owner";
import type { MailboxConnector } from "../types";

import { handleInbound, type InboundEffect } from "./handle";
import { normalizeMessageId, type MatchContext } from "./match";

export const SYNC_INTERVAL_MS = 5 * 60_000; // connectors without webhooks (IMAP)
export const SYNC_INTERVAL_WEBHOOK_MS = 15 * 60_000;
export const SYNC_LEASE_MS = 5 * 60_000;
export const SYNC_BUDGET_PER_MAILBOX_MS = 25_000;
export const MAX_SYNC_BACKOFF_MS = 2 * HOUR_MS;
export const MAX_MAILBOXES_PER_TICK = 20;
export const PAGE_LIMIT = 50;
export const LOOKBACK_MS = 7 * DAY_MS;
export const SENT_WINDOW_MS = 60 * DAY_MS;
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
        if (controller.signal.aborted && pages > 0) break;
        throw error;
      }
      for (const message of page.messages) {
        try {
          effects[await handleInbound(mailbox, message, ctx, now)]++;
        } catch (error) {
          console.error(`[mailbox-sync] ${mailbox.id} message ${message.id}`, error);
        }
      }
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
        messageId: { not: null },
      },
      select: { id: true, enrollmentId: true, messageId: true },
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
  for (const m of sent) {
    if (m.messageId) sentMessageIds.set(normalizeMessageId(m.messageId), { enrollmentId: m.enrollmentId, messageId: m.id });
  }
  return {
    mailboxAddress: mailbox.email,
    teamEmails: members.map((m) => m.user.email),
    sentMessageIds,
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
  opts: { budgetMs: number; organizationId?: string } & SyncDeps,
): Promise<{ synced: number; errors: number }> {
  const deadline = Date.now() + opts.budgetMs;
  const due = await prisma.mailbox.findMany({
    where: {
      status: "ACTIVE",
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
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
    orderBy: [{ syncRequestedAt: "asc" }, { nextSyncAt: "asc" }],
    take: MAX_MAILBOXES_PER_TICK,
  });

  let synced = 0;
  let errors = 0;
  for (const mailbox of due) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const lease = await prisma.mailbox.updateMany({
        where: {
          id: mailbox.id,
          OR: [{ syncClaimedAt: null }, { syncClaimedAt: { lt: new Date(now.getTime() - SYNC_LEASE_MS) } }],
        },
        data: { syncClaimedAt: now, syncRequestedAt: null },
      });
      // Someone else holds it: they will write the outcome
      if (lease.count === 0) continue;
    } catch (error) {
      console.error(`[mailbox-sync] ${mailbox.id} lease`, error);
      errors++;
      continue;
    }

    try {
      const connector = (opts.connector ?? connectorFor)(mailbox);
      const result = await syncMailbox(mailbox.id, now, {
        connector: () => connector,
        budgetMs: Math.min(SYNC_BUDGET_PER_MAILBOX_MS, remaining),
      });
      if (!result) {
        await prisma.mailbox.update({ where: { id: mailbox.id }, data: { syncClaimedAt: null } });
        continue;
      }
      const interval = connector.capabilities.webhooks ? SYNC_INTERVAL_WEBHOOK_MS : SYNC_INTERVAL_MS;
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { lastSyncAt: now, nextSyncAt: new Date(now.getTime() + interval), syncErrorCount: 0, syncClaimedAt: null },
      });
      synced++;
    } catch (error) {
      errors++;
      await recordFailure(mailbox.id, mailbox.syncErrorCount + 1, error, now);
    }
  }
  return { synced, errors };
}

async function recordFailure(mailboxId: string, failures: number, error: unknown, now: Date) {
  try {
    const code = isMailboxError(error) ? error.code : "TRANSIENT";
    const raw = isMailboxError(error) ? (error.options.detail ?? error.message) : error instanceof Error ? error.message : String(error);
    const detail = raw.slice(0, 300);
    const lastError = `${code}: ${detail}`;
    console.error(`[mailbox-sync] ${mailboxId}`, lastError);
    const backoff = Math.min(SYNC_INTERVAL_MS * 2 ** failures, MAX_SYNC_BACKOFF_MS);
    await prisma.mailbox.update({
      where: { id: mailboxId },
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
