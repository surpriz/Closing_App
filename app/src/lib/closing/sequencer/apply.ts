import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";

import { cancelOpenFollowups } from "../followups/queue";
import { recordProspectReply } from "../replies/record";
import { type SequencerEvent, sequencerToken } from "./event";

export function sequencerSecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  return secret;
}

/** Where the workspace's cold email tool reports replies, unsubscribes and bounces. */
export function sequencerWebhookUrl(organizationId: string) {
  return `${getPublicAppUrl()}/api/webhooks/sequencer/${sequencerToken(organizationId, sequencerSecret())}`;
}

/** The workspace's open links where this address is a contact: Smart Link readers and personal links alike. */
async function linksOf(organizationId: string, email: string) {
  return prisma.prospect.findMany({
    where: { email, link: { organizationId, archivedAt: null } },
    select: { id: true, linkId: true },
  });
}

/**
 * What the cold email tool reported, applied to every link this address
 * reads: a reply goes on the deal as one (follow-ups stop, the seller is
 * told), an unsubscribe or a bounce stops anything more going to them.
 * Idempotent per link, event and day: tools retry. Returns the links touched.
 */
export async function applySequencerEvent(organizationId: string, event: SequencerEvent, now = new Date()) {
  const contacts = await linksOf(organizationId, event.email);
  const day = now.toISOString().slice(0, 10);

  for (const contact of contacts) {
    if (event.kind === "replied") {
      await recordProspectReply({
        linkId: contact.linkId,
        prospectId: contact.id,
        followupId: null,
        fromEmail: event.email,
        excerpt: event.excerpt,
        occurredAt: now,
        source: "SEQUENCER",
        externalKey: `seq:${contact.linkId}:${event.email}:${day}`,
      });
      continue;
    }
    await prisma.prospect.updateMany({
      where: { id: contact.id, ...(event.kind === "bounced" ? { bouncedAt: null } : { unsubscribedAt: null }) },
      data: event.kind === "bounced" ? { bouncedAt: now, bounceDetail: "sequencer" } : { unsubscribedAt: now },
    });
    await cancelOpenFollowups(contact.linkId, event.kind === "bounced" ? "bounced" : "unsubscribed");
  }
  return contacts.length;
}
