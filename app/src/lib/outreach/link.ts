import { getPublicAppUrl } from "@/lib/app-origin";
import { createDocumentLink } from "@/lib/closing/documents/create-link";
import { linkTitle } from "@/lib/closing/documents/link-title";
import { viewerUrl } from "@/lib/closing/link-url";
import { prisma } from "@/lib/db";

export type CampaignLink = { linkId: string; prospectId: string | null; url: string; title: string };

/** The link as one message carries it: ?c=<message id> credits the opening to that message (like ?r= for follow-ups). */
export function campaignMessageUrl(url: string, messageId: string) {
  return `${url}${url.includes("?") ? "&" : "?"}c=${encodeURIComponent(messageId)}`;
}

const enrollmentSelect = {
  email: true,
  firstName: true,
  lastName: true,
  company: true,
  linkId: true,
  prospectId: true,
  campaign: { select: { organizationId: true, createdById: true, documentId: true } },
} as const;

/**
 * The Clozer link of an enrollment, created on first call: personal, no gate, never expires, follow-ups off
 * (the campaign owns the schedule). Null without a document. Throws PlanLimitError like createDocumentLink.
 */
export async function createCampaignLink(
  enrollmentId: string,
  opts: { owned: boolean; now?: Date },
): Promise<CampaignLink | null> {
  const enrollment = await prisma.campaignProspect.findUnique({ where: { id: enrollmentId }, select: enrollmentSelect });
  if (!enrollment) return null;
  if (enrollment.linkId) return loadLink(enrollment.linkId, enrollment);

  const { campaign } = enrollment;
  if (!campaign.documentId) return null;
  const created = await createDocumentLink({
    organizationId: campaign.organizationId,
    userId: campaign.createdById,
    documentId: campaign.documentId,
    prospect: {
      email: enrollment.email,
      name: [enrollment.firstName, enrollment.lastName].filter(Boolean).join(" ") || null,
      company: enrollment.company,
      origin: "CAMPAIGN",
    },
    requireEmail: false,
    expiresAt: null,
    followupsEnabled: false,
    source: "campaign",
  });
  if (!created) return null;

  let prospect: { id: string } | null;
  try {
    await prisma.link.update({
      where: { id: created.id },
      data: { campaignProspectId: enrollmentId, campaignOwned: opts.owned },
    });
    prospect = await prisma.prospect.findFirst({
      where: { linkId: created.id, email: enrollment.email },
      select: { id: true },
    });
    const claimed = await prisma.campaignProspect.updateMany({
      where: { id: enrollmentId, linkId: null },
      data: { linkId: created.id, prospectId: prospect?.id ?? null },
    });
    if (claimed.count === 0) {
      // Another pass attached its link first: ours is archived and theirs is used
      await archiveQuietly(created.id, opts.now);
      const winner = await prisma.campaignProspect.findUnique({ where: { id: enrollmentId }, select: enrollmentSelect });
      return winner?.linkId ? loadLink(winner.linkId, winner) : null;
    }
  } catch (error) {
    // No enrollment points at this link: archived so a retry does not leave (and count) a second one
    await archiveQuietly(created.id, opts.now);
    throw error;
  }

  return {
    linkId: created.id,
    prospectId: prospect?.id ?? null,
    url: `${getPublicAppUrl()}${created.path}`,
    title: created.title,
  };
}

async function loadLink(linkId: string, enrollment: { company: string | null; prospectId: string | null }) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      slug: true,
      document: { select: { name: true, displayTitle: true, docType: true } },
      prospects: { select: { id: true }, take: 1 },
    },
  });
  if (!link) return null;
  return {
    linkId,
    prospectId: enrollment.prospectId ?? link.prospects[0]?.id ?? null,
    url: viewerUrl(getPublicAppUrl(), { slug: link.slug, document: link.document, company: enrollment.company }),
    title: linkTitle({ ...link.document, company: enrollment.company }),
  };
}

async function archiveQuietly(linkId: string, now = new Date()) {
  try {
    await prisma.link.update({ where: { id: linkId }, data: { archivedAt: now } });
  } catch (error) {
    console.error(`[campaign-link] could not archive ${linkId}`, error);
  }
}
