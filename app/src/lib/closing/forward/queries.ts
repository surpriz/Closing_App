import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { HOUR_MS } from "../constants";
import { FORWARD_RECIPIENT_COOLDOWN_MS } from "./limits";

/** Forwards already made, for the quotas of quota.ts. Run in the transaction that creates the next one. */
export async function countRecentForwards(db: Prisma.TransactionClient, input: {
  linkId: string;
  organizationId: string;
  visitorId: string;
  ipHash: string | null;
  toEmail: string;
  now: Date;
}) {
  const { linkId, now } = input;
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [recipientRecent, visitorToday, ipLastHour, linkToday, workspaceToday] = await Promise.all([
    // Only one that went out: after a failure, trying again must send it
    db.linkForward.count({
      where: {
        linkId,
        sentAt: { not: null },
        toProspect: { email: input.toEmail },
        createdAt: { gte: new Date(now.getTime() - FORWARD_RECIPIENT_COOLDOWN_MS) },
      },
    }),
    db.linkForward.count({ where: { linkId, visitorId: input.visitorId, createdAt: { gte: dayStart } } }),
    input.ipHash ? db.linkForward.count({ where: { ipHash: input.ipHash, createdAt: { gte: hourAgo } } }) : 0,
    db.linkForward.count({ where: { linkId, createdAt: { gte: dayStart } } }),
    db.linkForward.count({ where: { link: { organizationId: input.organizationId }, createdAt: { gte: dayStart } } }),
  ]);
  return { recipientRecent, visitorToday, ipLastHour, linkToday, workspaceToday };
}

/** Said stop on any proposal of this workspace: an unsubscribe covers the whole sender. */
export async function isOptedOutInWorkspace(email: string, organizationId: string) {
  const row = await prisma.prospect.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      unsubscribedAt: { not: null },
      link: { organizationId },
    },
    select: { id: true },
  });
  return !!row;
}

/** Someone of the seller's own team. */
export async function isWorkspaceMemberEmail(email: string, organizationId: string) {
  const row = await prisma.member.findFirst({
    where: { organizationId, user: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true },
  });
  return !!row;
}
