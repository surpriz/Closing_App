import { getPublicAppUrl } from "@/lib/app-origin";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

import { DAY_MS } from "../constants";
import { tagLabels } from "../documents/doc-types";
import { isUniqueViolation } from "../followups/queue";
import { getWorkspaceSettings } from "../settings";
import { isHotReader } from "../shared/hot-readers";
import { readingOfLink } from "../shared/reading-time";
import { postSignedWebhook } from "./webhooks";

/**
 * Engagement events for a cold email tool, on the workspace's webhook: a Smart
 * Link reader started reading (pause their sequence), then stayed past the hot
 * threshold. Machine events: no quiet hours, no cap, but stored first and
 * retried by the cron, since a missed one sends the prospect the generic step 3.
 */

export type ReaderEvent = "reader.opened" | "reader.hot" | "reader.forwarded";

/** Waits before each retry; past the last one the event is dropped. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
/** Claimed by one sender for this long, so the cron and a request never send it twice. */
const CLAIM_MS = 60_000;
const KEEP_DAYS = 30;

/** The reader's own link of a Smart Link, when a cold email brought them. */
async function smartReader(linkId: string) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      parentLinkId: true,
      organizationId: true,
      hotPricingThresholdSec: true,
      document: { select: { id: true, name: true, docType: true } },
      prospects: {
        where: { origin: "COLD_EMAIL" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, email: true, name: true, company: true },
      },
    },
  });
  const prospect = link?.prospects[0];
  return link?.parentLinkId && prospect ? { link: { ...link, parentLinkId: link.parentLinkId }, prospect } : null;
}

/** Fired once per reader and event. Does nothing without a webhook or for other readers. */
export async function emitReaderEvent(linkId: string, event: Exclude<ReaderEvent, "reader.forwarded">) {
  // Most tracking flushes land here after the event went out: one cheap lookup
  if (await prisma.webhookEvent.findFirst({ where: { linkId, event }, select: { id: true } })) return;
  const reader = await smartReader(linkId);
  if (!reader) return;
  const { link, prospect } = reader;
  const dedupeKey = `${event}:${prospect.id}`;

  const settings = await getWorkspaceSettings(link.organizationId);
  if (!settings.outboundWebhookUrl || !settings.webhookSecret) return;

  const reading = await readingOfLink(link.id, link.document.id);
  if (event === "reader.hot") {
    const threshold = link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec;
    if (!isHotReader(reading, threshold)) return;
  }

  const labels = tagLabels(link.document.docType);
  const payload = {
    email: prospect.email,
    company: prospect.company,
    name: prospect.name,
    smartLinkId: link.parentLinkId,
    readerLinkId: link.id,
    document: link.document.name,
    readingSeconds: Math.round(reading.readingMs / 1000),
    pricingSeconds: Math.round(reading.pricingMs / 1000),
    sections: reading.tags.filter((tag) => tag !== "OTHER").map((tag) => labels[tag]),
    dashboardUrl: `${getPublicAppUrl()}/links/${link.id}`,
  };

  await queueWebhookEvent(link.id, event, dedupeKey, payload);
}

/**
 * A reader passed the proposal on with "Transférer": for a CRM or a sequence
 * tool, a new contact in the buying team. Any link, not only Smart Links.
 */
export async function emitForwardEvent(forwardId: string) {
  const forward = await prisma.linkForward.findUnique({
    where: { id: forwardId },
    select: {
      linkId: true,
      message: true,
      createdAt: true,
      link: { select: { organizationId: true, document: { select: { name: true } } } },
      fromProspect: { select: { email: true, name: true } },
      toProspect: { select: { email: true, name: true, company: true } },
    },
  });
  if (!forward) return;
  const settings = await getWorkspaceSettings(forward.link.organizationId);
  if (!settings.outboundWebhookUrl || !settings.webhookSecret) return;

  await queueWebhookEvent(forward.linkId, "reader.forwarded", `reader.forwarded:${forwardId}`, {
    linkId: forward.linkId,
    document: forward.link.document.name,
    from: forward.fromProspect,
    to: forward.toProspect,
    message: forward.message,
    forwardedAt: forward.createdAt.toISOString(),
    dashboardUrl: `${getPublicAppUrl()}/links/${forward.linkId}#circuit`,
  });
}

/** Stored first, then sent: the cron retries what fails. Once per dedupe key. */
async function queueWebhookEvent(linkId: string, event: ReaderEvent, dedupeKey: string, payload: object) {
  let id: string;
  try {
    ({ id } = await prisma.webhookEvent.create({
      data: { linkId, event, dedupeKey, payload },
      select: { id: true },
    }));
  } catch (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }
  await deliverWebhookEvent(id);
}

async function deliverWebhookEvent(id: string, now = new Date()) {
  // Claim it: only one sender past this point
  const claimed = await prisma.webhookEvent.updateMany({
    where: { id, status: "PENDING", nextAttemptAt: { lte: now } },
    data: { nextAttemptAt: new Date(now.getTime() + CLAIM_MS) },
  });
  if (claimed.count === 0) return;

  const row = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id },
    select: {
      event: true,
      payload: true,
      attempts: true,
      link: { select: { organization: { select: { suspendedAt: true, settings: true } } } },
    },
  });
  const { suspendedAt, settings } = row.link.organization;
  const attempts = row.attempts + 1;
  try {
    if (suspendedAt) throw new Error("workspace suspendu");
    if (!settings?.outboundWebhookUrl || !settings.webhookSecret) throw new Error("webhook débranché");
    await postSignedWebhook(settings.outboundWebhookUrl, decryptSecret(settings.webhookSecret), row.event, row.payload);
    await prisma.webhookEvent.update({
      where: { id },
      data: { status: "SENT", attempts, sentAt: new Date(), lastError: null },
    });
  } catch (error) {
    const delay = RETRY_DELAYS_MS[attempts - 1];
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        attempts,
        lastError: error instanceof Error ? error.message.slice(0, 500) : "échec",
        ...(delay === undefined
          ? { status: "FAILED" as const }
          : { nextAttemptAt: new Date(now.getTime() + delay) }),
      },
    });
  }
}

/** Cron: sends what failed or never left, then forgets old events. */
export async function retryEngagementWebhooks(now = new Date()) {
  const due = await prisma.webhookEvent.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: 50,
    select: { id: true },
  });
  for (const { id } of due) await deliverWebhookEvent(id, now);
  await prisma.webhookEvent.deleteMany({
    where: { status: { not: "PENDING" }, createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * DAY_MS) } },
  });
  return due.length;
}
