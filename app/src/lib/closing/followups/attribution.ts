import { prisma } from "@/lib/db";

/**
 * Follow-up links carry ?r=<followup id>: an opening that comes from one is credited to it, for
 * the "what works" stats. The id only counts on its own link, so a pasted one proves nothing.
 */

/** The link a follow-up points to, with its tracking parameter. */
export function followupUrl(baseUrl: string, followupId: string) {
  return `${baseUrl}?r=${followupId}`;
}

export async function followupOfLink(followupId: string | null | undefined, linkId: string) {
  if (!followupId) return null;
  const followup = await prisma.followup.findFirst({ where: { id: followupId, linkId }, select: { id: true } });
  return followup?.id ?? null;
}

/** First opening from this follow-up: the gate or the reader, whichever comes first. */
export async function markFollowupClicked(followupId: string, linkId: string, now = new Date()) {
  await prisma.followup.updateMany({
    where: { id: followupId, linkId, clickedAt: null, sentAt: { not: null } },
    data: { clickedAt: now },
  });
}
