import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { userStatus, type UserStatus } from "@/lib/platform-admin";

export const STATUS_FILTERS = { actif: "active", desactive: "disabled", banni: "banned" } as const satisfies Record<
  string,
  UserStatus
>;

export type StatusFilter = keyof typeof STATUS_FILTERS;

export function parseStatusFilter(value: string | undefined): StatusFilter | undefined {
  return value && value in STATUS_FILTERS ? (value as StatusFilter) : undefined;
}

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
  return userStatus(user, blocked.has(user.email.toLowerCase()), now);
}
