import { getPublicAppUrl } from "@/lib/app-origin";
import { signingSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { addSuppression } from "@/lib/outreach/suppression";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { recordProspectReply } from "../replies/record";
import { stopClosingSide } from "../unsubscribe";
import { type SequencerEvent, sequencerToken, verifySequencerToken } from "./event";

/** A reply the mailbox sync, the reply relay or the extension logged this recently is the same reply. */
const SAME_REPLY_MS = 2 * 24 * 60 * 60 * 1000;

/** Where the workspace's cold email tool reports replies, unsubscribes and bounces. */
export async function sequencerWebhookUrl(organizationId: string) {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { organizationId },
    select: { sequencerTokenVersion: true },
  });
  const token = sequencerToken(organizationId, settings?.sequencerTokenVersion ?? 0, signingSecret());
  return `${getPublicAppUrl()}/api/webhooks/sequencer/${token}`;
}

/** The workspace a token stands for, while its version is the current one. */
export async function sequencerWorkspace(token: string) {
  const claim = verifySequencerToken(token, signingSecret());
  if (!claim) return null;
  const settings = await prisma.workspaceSettings.findUnique({
    where: { organizationId: claim.organizationId },
    select: { sequencerTokenVersion: true },
  });
  return (settings?.sequencerTokenVersion ?? 0) === claim.version ? claim.organizationId : null;
}

/**
 * What the cold email tool reported, applied to every open link this address
 * reads in the workspace. A reply goes on the deal like any other (follow-ups
 * stop, the seller is told) unless another path logged it already. An
 * unsubscribe or a bounce works like Clozer's own: the address joins the
 * suppression list, and that prospect's follow-ups stop, nobody else's.
 */
export async function applySequencerEvent(organizationId: string, event: SequencerEvent, now = new Date()) {
  const sameAddress = { email: { equals: event.email, mode: "insensitive" as const } };

  if (event.kind !== "replied") {
    // The reason lands on follow-ups the seller reads: in the language of the seller who sent the link
    const contact = await prisma.prospect.findFirst({
      where: { ...sameAddress, link: { organizationId } },
      orderBy: { createdAt: "desc" },
      select: { link: { select: { createdBy: { select: { locale: true } } } } },
    });
    const reason = getNamespaceTranslator(toUiLocale(contact?.link.createdBy?.locale), "server.followups.dispatch")(
      event.kind,
    );
    await addSuppression({
      organizationId,
      email: event.email,
      reason: event.kind === "bounced" ? "BOUNCE" : "UNSUBSCRIBE",
      source: "sequencer_webhook",
    });
    await stopClosingSide(organizationId, event.email, reason, event.kind === "bounced" ? "bouncedAt" : "unsubscribedAt");
    return;
  }

  const contacts = await prisma.prospect.findMany({
    where: { ...sameAddress, link: { organizationId, archivedAt: null } },
    select: { id: true, linkId: true },
  });
  const day = now.toISOString().slice(0, 10);
  for (const contact of contacts) {
    const logged = await prisma.sellerActivity.findFirst({
      where: {
        linkId: contact.linkId,
        type: "EMAIL_REPLY_RECEIVED",
        source: { not: "SEQUENCER" },
        fromEmail: sameAddress.email,
        occurredAt: { gte: new Date(now.getTime() - SAME_REPLY_MS) },
      },
      select: { id: true },
    });
    if (logged) continue;
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
  }
}
