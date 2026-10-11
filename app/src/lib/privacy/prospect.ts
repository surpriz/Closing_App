import { prisma } from "@/lib/db";

import { deleteBlobs, KEPT_ACTION_TYPES } from "./erase";

/**
 * A prospect asks the seller what Clozer knows about them, or to be forgotten.
 * Everything is found from the email inside one workspace: the prospect rows,
 * the views opened with that email or tied to those rows, and what hangs off them.
 */

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findTrail(organizationId: string, email: string) {
  const prospects = await prisma.prospect.findMany({
    where: { email: { equals: email, mode: "insensitive" }, link: { organizationId } },
    select: { id: true, linkId: true },
  });
  const prospectIds = prospects.map((p) => p.id);
  const views = await prisma.documentView.findMany({
    where: {
      link: { organizationId },
      OR: [{ email: { equals: email, mode: "insensitive" } }, { prospectId: { in: prospectIds } }],
    },
    select: { id: true, linkId: true },
  });
  const viewIds = views.map((v) => v.id);
  const linkIds = [...new Set([...prospects.map((p) => p.linkId), ...views.map((v) => v.linkId)])];
  return { prospectIds, viewIds, linkIds };
}

export function alertsWhere(organizationId: string, email: string, viewIds: string[]) {
  return {
    link: { organizationId },
    OR: [
      { payload: { path: ["prospectEmail"], equals: email } },
      ...viewIds.map((viewId) => ({ payload: { path: ["viewId"], equals: viewId } })),
    ],
  };
}

export async function exportProspectData(organizationId: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const { prospectIds, viewIds } = await findTrail(organizationId, email);

  const [prospects, views, chatMessages, voiceComments, actions, followups, alerts] = await Promise.all([
    prisma.prospect.findMany({
      where: { id: { in: prospectIds } },
      include: { link: { select: { name: true, document: { select: { name: true } } } } },
    }),
    prisma.documentView.findMany({
      where: { id: { in: viewIds } },
      omit: { visitorId: true, ipHash: true },
      include: { pageViews: { select: { pageNumber: true, totalDurationMs: true, maxScrollDepth: true, firstSeenAt: true, lastSeenAt: true } } },
    }),
    prisma.chatMessage.findMany({
      where: { viewId: { in: viewIds } },
      select: { role: true, content: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.voiceComment.findMany({
      where: { OR: [{ viewId: { in: viewIds } }, { prospectId: { in: prospectIds } }] },
      select: { pageNumber: true, durationMs: true, transcript: true, createdAt: true },
    }),
    prisma.prospectAction.findMany({
      where: { OR: [{ viewId: { in: viewIds } }, { prospectId: { in: prospectIds } }] },
      select: { type: true, message: true, signerName: true, createdAt: true },
    }),
    prisma.followup.findMany({
      where: { prospectId: { in: prospectIds }, sentAt: { not: null } },
      select: { channel: true, subject: true, body: true, sentAt: true },
    }),
    prisma.sellerAlert.count({ where: alertsWhere(organizationId, email, viewIds) }),
  ]);

  return {
    email,
    exportedAt: new Date().toISOString(),
    prospects,
    views,
    chatMessages,
    voiceComments,
    actions,
    followupsSent: followups,
    sellerAlerts: alerts,
  };
}

export async function countProspectData(organizationId: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const { prospectIds, viewIds, linkIds } = await findTrail(organizationId, email);
  const signatures = await prisma.prospectAction.count({
    where: {
      type: { in: [...KEPT_ACTION_TYPES] },
      OR: [{ viewId: { in: viewIds } }, { prospectId: { in: prospectIds } }],
    },
  });
  return { email, links: linkIds.length, prospects: prospectIds.length, views: viewIds.length, signatures };
}

// Signed validations stay: they prove the agreement and the seller may need them.
// The deal analyses of the links involved are dropped, they quote the reader.
export async function eraseProspectData(organizationId: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const { prospectIds, viewIds, linkIds } = await findTrail(organizationId, email);
  if (prospectIds.length === 0 && viewIds.length === 0) return { erased: false as const };

  const voice = await prisma.voiceComment.findMany({
    where: { OR: [{ viewId: { in: viewIds } }, { prospectId: { in: prospectIds } }] },
    select: { blobPathname: true },
  });
  await deleteBlobs(voice.map((v) => v.blobPathname));

  const byReader = { OR: [{ viewId: { in: viewIds } }, { prospectId: { in: prospectIds } }] };
  await prisma.$transaction([
    prisma.voiceComment.deleteMany({ where: byReader }),
    prisma.chatMessage.deleteMany({ where: { viewId: { in: viewIds } } }),
    prisma.capsulePlay.deleteMany({ where: { viewId: { in: viewIds } } }),
    prisma.pageView.deleteMany({ where: { viewId: { in: viewIds } } }),
    prisma.prospectAction.deleteMany({ where: { ...byReader, type: { notIn: [...KEPT_ACTION_TYPES] } } }),
    prisma.sellerAlert.deleteMany({ where: alertsWhere(organizationId, email, viewIds) }),
    prisma.sellerActivity.deleteMany({ where: { prospectId: { in: prospectIds } } }),
    prisma.documentView.deleteMany({ where: { id: { in: viewIds } } }),
    prisma.prospect.deleteMany({ where: { id: { in: prospectIds } } }),
    prisma.dealInsight.deleteMany({ where: { linkId: { in: linkIds } } }),
    prisma.link.updateMany({ where: { id: { in: linkIds } }, data: { brainDirtyAt: new Date() } }),
  ]);
  return { erased: true as const, links: linkIds.length };
}
