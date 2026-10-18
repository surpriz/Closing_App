import { prisma } from "@/lib/db";
import { toUiLocale } from "@/lib/seller-locale";

import { generateFollowupMessage, queueFollowup } from "../followups/queue";
import type { DeadState } from "../revival";
import { defaultTimezone } from "../settings";

/**
 * The seller reopened a link the prospect had come back to: an "available
 * again" email, written now and left as a draft. The seller asked for it, so
 * they read it before it goes. At most one per link and death.
 */
export async function queueInterestFollowup(linkId: string, prospectId: string, dead: DeadState, now = new Date()) {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, linkId, unsubscribedAt: null },
    select: {
      id: true,
      locale: true,
      timezone: true,
      link: { select: { createdBy: { select: { locale: true } } } },
    },
  });
  if (!prospect) return;

  const followupId = await queueFollowup({
    linkId,
    prospectId: prospect.id,
    trigger: "INTEREST_RETURNED",
    channel: "EMAIL",
    scheduledFor: now,
    timezone: prospect.timezone ?? defaultTimezone(),
    locale: prospect.locale ?? toUiLocale(prospect.link.createdBy?.locale),
    dedupeKey: `interest_returned:${linkId}:${dead.since.getTime()}`,
    context: { deadState: dead.kind, deadSince: dead.since.toISOString() },
  });
  if (followupId) await generateFollowupMessage(followupId);
}
