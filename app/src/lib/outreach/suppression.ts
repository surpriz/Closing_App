import type { SuppressionReason } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const PROSPECT_FLAGS = [{ unsubscribedAt: { not: null } }, { bouncedAt: { not: null } }, { complainedAt: { not: null } }];

const normalize = (email: string) => email.trim().toLowerCase();

/** Suppression row, or a prospect of the org that unsubscribed, bounced or complained. */
export async function isSuppressed(organizationId: string, email: string): Promise<boolean> {
  const address = normalize(email);
  const listed = await prisma.suppression.findFirst({ where: { organizationId, email: address }, select: { id: true } });
  if (listed) return true;
  const flagged = await prisma.prospect.findFirst({
    where: { link: { organizationId }, email: { equals: address, mode: "insensitive" }, OR: PROSPECT_FLAGS },
    select: { id: true },
  });
  return flagged !== null;
}

/** Same rule in bulk (two queries); returns lowercase addresses. */
export async function suppressedAmong(organizationId: string, emails: string[]): Promise<Set<string>> {
  const addresses = [...new Set(emails.map(normalize))];
  if (addresses.length === 0) return new Set();
  const [listed, flagged] = await Promise.all([
    prisma.suppression.findMany({ where: { organizationId, email: { in: addresses } }, select: { email: true } }),
    prisma.prospect.findMany({
      where: {
        link: { organizationId },
        OR: PROSPECT_FLAGS,
        email: { in: addresses, mode: "insensitive" },
      },
      select: { email: true },
    }),
  ]);
  return new Set([...listed, ...flagged].map((row) => normalize(row.email)));
}

/** True when a new row was created, false when the address was already listed. */
export async function addSuppression(input: {
  organizationId: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  detail?: string | null;
}): Promise<boolean> {
  const { count } = await prisma.suppression.createMany({
    data: [
      {
        organizationId: input.organizationId,
        email: normalize(input.email),
        reason: input.reason,
        source: input.source,
        detail: input.detail ?? null,
      },
    ],
    skipDuplicates: true,
  });
  return count > 0;
}

export async function listSuppressions(organizationId: string, take = 20) {
  return prisma.suppression.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, email: true, reason: true, source: true, createdAt: true },
  });
}

export async function countSuppressions(organizationId: string): Promise<number> {
  return prisma.suppression.count({ where: { organizationId } });
}

/** The whole stop list for the CSV export, oldest first. */
export async function allSuppressions(organizationId: string) {
  return prisma.suppression.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { email: true, reason: true, source: true, detail: true, createdAt: true },
  });
}

/** Only a row the seller added by hand can go: unsubscribes, bounces and complaints must stay. */
export async function removeManualSuppression(organizationId: string, id: string): Promise<boolean> {
  const { count } = await prisma.suppression.deleteMany({ where: { id, organizationId, reason: "MANUAL" } });
  return count > 0;
}
