import { prisma } from "@/lib/db";

/**
 * Reserves one send of the mailbox's local day; false when the day is full. Never refunded: a failed send after it
 * is a conservative loss. One atomic UPDATE, so two workers racing for the last slot cannot both get it. A database
 * error is thrown, unlike the rate limiter: sending without a reservation could blow past the daily cap.
 */
export async function reserveSend(mailboxId: string, localDay: string, allowance: number) {
  // A new day with an allowance of 0 would otherwise let the first send through (sentDay differs)
  if (allowance <= 0) return false;
  const rows = await prisma.$queryRaw<{ sentCount: number }[]>`
    UPDATE mailboxes SET "sentCount" = CASE WHEN "sentDay" = ${localDay} THEN "sentCount" + 1 ELSE 1 END, "sentDay" = ${localDay}
    WHERE id = ${mailboxId} AND ("sentDay" IS DISTINCT FROM ${localDay} OR "sentCount" < ${allowance}) RETURNING "sentCount"`;
  return rows.length > 0;
}
