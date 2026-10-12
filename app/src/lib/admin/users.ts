import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeEmail, userStatus, type UserStatus } from "@/lib/platform-admin";

export const USER_FILTERS = {
  actif: { label: "Actifs", status: "active" },
  desactive: { label: "Désactivés", status: "disabled" },
  banni: { label: "Bannis", status: "banned" },
} as const;

/** Banned = blocked email; disabled = ban still running; active = the rest. */
export function userStatusWhere(status: UserStatus, blockedEmails: string[], now: Date): Prisma.UserWhereInput {
  const running: Prisma.UserWhereInput = {
    banned: true,
    OR: [{ banExpires: null }, { banExpires: { gt: now } }],
  };
  if (status === "banned") return { email: { in: blockedEmails } };
  if (status === "disabled") return { AND: [running, { email: { notIn: blockedEmails } }] };
  return { NOT: running, email: { notIn: blockedEmails } };
}

export async function loadBlockedEmails() {
  const rows = await prisma.blockedEmail.findMany({ select: { email: true } });
  return rows.map((row) => row.email);
}

export function statusOf(
  user: { email: string; banned: boolean; banExpires: Date | null },
  blocked: Set<string>,
  now = new Date(),
) {
  return userStatus(user, blocked.has(normalizeEmail(user.email)), now);
}
