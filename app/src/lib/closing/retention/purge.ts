import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import { deleteDocumentForever, eraseLinkTracking, KEPT_ACTION_TYPES } from "@/lib/privacy/erase";
import { purgeRequestLimits } from "@/lib/rate-limit";

// Stated in the privacy policy: change both together
export const RETENTION_MONTHS = 12;
export const ARCHIVE_GRACE_DAYS = 30;
export const SIGNATURE_RETENTION_YEARS = 5;

// Small batches: this runs on every closing tick
const LINK_BATCH = 20;
const DOCUMENT_BATCH = 10;

// Sent campaign bodies and inbound mailbox events: stated in the privacy policy too
export const MESSAGE_BODY_RETENTION_DAYS = 90;
const BODY_BATCH = 200;
const INBOUND_BATCH = 500;

export function messageBodyCutoff(now: Date) {
  return new Date(now.getTime() - MESSAGE_BODY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Blanks the rendered body, keeps the row: subject, dates, Message-ID and outcomes feed results and threading. */
export async function purgeCampaignMessageBodies(now: Date, batch = BODY_BATCH): Promise<number> {
  const cutoff = messageBodyCutoff(now);
  const rows = await prisma.campaignMessage.findMany({
    where: {
      body: { not: "" },
      OR: [{ sentAt: { lt: cutoff } }, { status: { in: ["FAILED", "CANCELLED", "SKIPPED"] }, updatedAt: { lt: cutoff } }],
    },
    select: { id: true },
    take: batch,
  });
  if (rows.length === 0) return 0;
  const { count } = await prisma.campaignMessage.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { body: "" },
  });
  return count;
}

export async function purgeInboundEvents(now: Date, batch = INBOUND_BATCH): Promise<number> {
  const rows = await prisma.mailboxInboundEvent.findMany({
    where: { receivedAt: { lt: messageBodyCutoff(now) } },
    select: { id: true },
    take: batch,
  });
  if (rows.length === 0) return 0;
  const { count } = await prisma.mailboxInboundEvent.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  return count;
}

export function retentionCutoffs(now: Date) {
  const tracking = new Date(now);
  tracking.setUTCMonth(tracking.getUTCMonth() - RETENTION_MONTHS);
  const archive = new Date(now.getTime() - ARCHIVE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const signature = new Date(now);
  signature.setUTCFullYear(signature.getUTCFullYear() - SIGNATURE_RETENTION_YEARS);
  return { tracking, archive, signature };
}

// Quiet for the whole retention period (never opened: counted from creation)
// and still holding something about a reader
export function staleLinkWhere(cutoff: Date): Prisma.LinkWhereInput {
  return {
    OR: [{ lastActivityAt: { lt: cutoff } }, { lastActivityAt: null, createdAt: { lt: cutoff } }],
    AND: [
      {
        OR: [
          { views: { some: {} } },
          { prospects: { some: {} } },
          { alerts: { some: {} } },
          { chatMessages: { some: {} } },
          { voiceComments: { some: {} } },
          { followups: { some: {} } },
          { insights: { some: {} } },
          { sellerActivities: { some: {} } },
          { engagementScore: { isNot: null } },
          { actions: { some: { type: { notIn: [...KEPT_ACTION_TYPES] } } } },
          { decisionMakerName: { not: null } },
          { decisionMakerRole: { not: null } },
          { sellerNotes: { not: null } },
        ],
      },
    ],
  };
}

// Archived by the seller long enough ago to rule out a mistake. A document with a
// signed link waits: the signature proof goes with it.
export function expiredArchiveWhere(cutoff: Date): Prisma.DocumentWhereInput {
  return {
    archivedAt: { lt: cutoff },
    links: { none: { actions: { some: { type: { in: [...KEPT_ACTION_TYPES] } } } } },
  };
}

export async function purgeExpiredData(now = new Date()) {
  const cutoffs = retentionCutoffs(now);

  const links = await prisma.link.findMany({
    where: staleLinkWhere(cutoffs.tracking),
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: LINK_BATCH,
  });
  for (const { id } of links) {
    await eraseLinkTracking(id);
  }

  const documents = await prisma.document.findMany({
    where: expiredArchiveWhere(cutoffs.archive),
    select: { id: true },
    orderBy: { archivedAt: "asc" },
    take: DOCUMENT_BATCH,
  });
  for (const { id } of documents) {
    await deleteDocumentForever(id);
  }

  const [signatures, sessions, verifications] = await prisma.$transaction([
    prisma.prospectAction.deleteMany({
      where: { type: { in: [...KEPT_ACTION_TYPES] }, createdAt: { lt: cutoffs.signature } },
    }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  const requestLimits = await purgeRequestLimits(now);
  const auditLogs = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoffs.tracking } } });

  const messageBodiesPurged = await purgeCampaignMessageBodies(now);
  const inboundEventsDeleted = await purgeInboundEvents(now);

  return {
    linksErased: links.length,
    documentsDeleted: documents.length,
    signaturesDeleted: signatures.count,
    sessionsDeleted: sessions.count,
    verificationsDeleted: verifications.count,
    requestLimitsDeleted: requestLimits,
    auditLogsDeleted: auditLogs.count,
    messageBodiesPurged,
    inboundEventsDeleted,
  };
}
