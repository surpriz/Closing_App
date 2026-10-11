import { prisma } from "@/lib/db";

import { pollPendingReveals } from "./reveal";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Engine step. Follows reveals in flight, and forgets who was turned down or could not be
 * reached after 30 days: only the dedupe key stays, so they are not suggested again.
 */
export async function runProspectingTick(now = new Date()) {
  await pollPendingReveals(now);

  const purged = await prisma.prospectSuggestion.updateMany({
    where: {
      status: { in: ["REJECTED", "INVALID"] },
      updatedAt: { lt: new Date(now.getTime() - PURGE_AFTER_MS) },
      firstName: { not: null },
    },
    data: {
      firstName: null,
      lastNameMasked: null,
      lastName: null,
      title: null,
      email: null,
      linkedinUrl: null,
      hookSubject: null,
      hookBody: null,
    },
  });
  return { purged: purged.count };
}
