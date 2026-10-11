import { prisma } from "@/lib/db";

import { pollPendingReveals } from "./reveal";
import { expireStaleRuns } from "./search";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** Everything that identifies the person or their company; the hashed dedupe key stays. */
export const PERSONAL_FIELDS = {
  firstName: null,
  lastNameMasked: null,
  lastName: null,
  title: null,
  email: null,
  linkedinUrl: null,
  companyName: null,
  companyDomain: null,
  companySiren: null,
  hookSubject: null,
  hookBody: null,
} as const;

/**
 * Engine step. Follows reveals in flight, fails searches whose function died, and forgets who
 * was turned down or could not be reached after 30 days: only the hashed dedupe key stays, so
 * they are not suggested again.
 */
export async function runProspectingTick(now = new Date()) {
  await expireStaleRuns(now);
  await pollPendingReveals(now);

  const purged = await prisma.prospectSuggestion.updateMany({
    where: {
      status: { in: ["REJECTED", "INVALID"] },
      updatedAt: { lt: new Date(now.getTime() - PURGE_AFTER_MS) },
      firstName: { not: null },
    },
    data: PERSONAL_FIELDS,
  });
  return { purged: purged.count };
}
