import { prisma } from "@/lib/db";

import type { AlertPayload } from "./alerts/send-alert";
import { type DeadState, revivalRequestKey, revivalWho } from "./revival";

/**
 * Who is back on a dead link, as the page, the passive signal and the request
 * all see it, and whether they already asked since it died.
 */
export async function findRevivalReader(
  link: { id: string },
  dead: DeadState,
  seen: { email: string | null; visitorId?: string | null; ipHash?: string | null },
) {
  const prospect = seen.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: seen.email } },
        select: { id: true, name: true, email: true, locale: true },
      })
    : null;
  const who = revivalWho({ prospectId: prospect?.id, visitorId: seen.visitorId, ipHash: seen.ipHash });
  const requestKey = revivalRequestKey(link.id, dead, who);
  const asked = !!(await prisma.sellerAlert.findUnique({ where: { dedupeKey: requestKey }, select: { id: true } }));
  return { prospect, who, requestKey, asked };
}

/** The same facts on every revival alert: who came back, and why the link no longer opened. */
export function revivalPayload(
  prospect: { id: string; name: string | null; email: string } | null,
  dead: DeadState,
): AlertPayload {
  return {
    prospectId: prospect?.id ?? null,
    prospectName: prospect?.name ?? null,
    prospectEmail: prospect?.email ?? null,
    deadState: dead.kind,
    ...(dead.kind === "expired" && { expiresAt: dead.since.toISOString() }),
  };
}
