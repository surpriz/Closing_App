import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import type { AdminAction } from "./format";

export type AuditTarget = "user" | "organization" | "settings";

/** One line in the admin journal per action taken from /admin. */
export function logAdminAction(entry: {
  actorId: string;
  action: AdminAction;
  targetType: AuditTarget;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.adminAuditLog.create({ data: entry });
}

/** Journal lines, newest first, with the acting admin's email. */
export async function loadAuditEntries(where: Prisma.AdminAuditLogWhereInput, page = { skip: 0, take: 20 }) {
  const entries = await prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...page });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(entries.map((entry) => entry.actorId))] } },
    select: { id: true, email: true },
  });
  const emails = new Map(actors.map((actor) => [actor.id, actor.email]));
  return entries.map((entry) => ({ ...entry, actorEmail: emails.get(entry.actorId) ?? null }));
}

export type AuditEntry = Awaited<ReturnType<typeof loadAuditEntries>>[number];
