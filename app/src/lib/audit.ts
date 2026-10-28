import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type AuditAction =
  | "member.invited"
  | "member.invitation_cancelled"
  | "member.role_changed"
  | "member.removed"
  | "workspace.exported"
  | "workspace.deleted"
  | "account.deleted"
  | "prospect.exported"
  | "prospect.erased"
  | "document.archived"
  | "extension.connected"
  | "extension.revoked"
  | "outlook.connected"
  | "mailbox.connected"
  | "mailbox.disconnected"
  | "mailbox.cap_changed"
  | "suppression.added"
  | "suppression.removed";

/**
 * One line in the workspace's journal. Never throws: a journal outage must not
 * undo or block what the seller just did.
 */
export async function logAudit(entry: {
  organizationId: string;
  actorUserId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (error) {
    console.error(`[audit] could not log ${entry.action}`, error);
  }
}
