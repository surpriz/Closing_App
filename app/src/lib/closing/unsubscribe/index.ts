import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { addSuppression } from "@/lib/outreach/suppression";
import { addOptOut } from "@/lib/prospecting/opt-out";
import { getSellerLocale, toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import {
  createUnsubscribeToken,
  encodeUnsubscribeSubject,
  parseUnsubscribeSubject,
  verifyUnsubscribeToken,
  type UnsubscribeSubject,
} from "./token";

// ENCRYPTION_KEY never rotates (it would make stored secrets unreadable),
// so links already sent keep working.
function unsubscribeSecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  }
  return secret;
}

export function unsubscribeToken(subject: UnsubscribeSubject) {
  return createUnsubscribeToken(encodeUnsubscribeSubject(subject), unsubscribeSecret());
}

export function unsubscribePageUrl(subject: UnsubscribeSubject) {
  return `${getPublicAppUrl()}/u/${unsubscribeToken(subject)}`;
}

export function unsubscribeOneClickUrl(subject: UnsubscribeSubject) {
  return `${getPublicAppUrl()}/api/unsubscribe/${unsubscribeToken(subject)}`;
}

/** What a token points at: a one-off prospect (closing follow-ups) or a campaign enrollment (cold sequence). */
export async function findUnsubscribeTarget(token: string) {
  const raw = verifyUnsubscribeToken(token, unsubscribeSecret());
  const subject = raw ? parseUnsubscribeSubject(raw) : null;
  if (!subject) return null;

  if (subject.kind === "enrollment") {
    const enrollment = await prisma.campaignProspect.findUnique({
      where: { id: subject.id },
      select: {
        id: true,
        email: true,
        status: true,
        organizationId: true,
        campaign: { select: { createdById: true, mailbox: { select: { displayName: true, email: true } } } },
      },
    });
    if (!enrollment) return null;
    return {
      kind: "enrollment" as const,
      email: enrollment.email,
      alreadyDone: enrollment.status === "UNSUBSCRIBED",
      organizationId: enrollment.organizationId,
      enrollment: { id: enrollment.id, campaign: enrollment.campaign },
    };
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id: subject.id },
    select: {
      id: true,
      email: true,
      unsubscribedAt: true,
      origin: true,
      linkId: true,
      link: { select: { organizationId: true, createdBy: { select: { locale: true } } } },
    },
  });
  if (!prospect) return null;
  return {
    kind: "prospect" as const,
    email: prospect.email,
    alreadyDone: !!prospect.unsubscribedAt,
    organizationId: prospect.link.organizationId,
    prospect,
  };
}

/** Flags every prospect of the workspace with this address and cancels their open follow-ups. */
async function stopClosingSide(organizationId: string, email: string, reason: string) {
  const now = new Date();
  const sameAddress = {
    email: { equals: email, mode: "insensitive" as const },
    link: { organizationId },
  };
  await prisma.$transaction([
    prisma.prospect.updateMany({
      where: { ...sameAddress, unsubscribedAt: null },
      data: { unsubscribedAt: now },
    }),
    prisma.followup.updateMany({
      where: {
        prospect: sameAddress,
        status: { in: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"] },
      },
      data: { status: "CANCELLED", cancelledAt: now, error: reason },
    }),
  ]);
}

export async function unsubscribeByToken(token: string) {
  const target = await findUnsubscribeTarget(token);
  if (!target) return false;

  if (target.kind === "enrollment") {
    const { id, campaign } = target.enrollment;
    // The reason lands on follow-ups the seller reads: in the seller's language, like the other cancellations
    const locale = await getSellerLocale(campaign.createdById);
    const reason = getNamespaceTranslator(locale, "server.followups.dispatch")("unsubscribed");

    await prisma.$transaction([
      prisma.campaignProspect.updateMany({
        where: { id, status: { notIn: ["UNSUBSCRIBED"] } },
        data: { status: "UNSUBSCRIBED" },
      }),
      prisma.campaignMessage.updateMany({
        where: { enrollmentId: id, status: { in: ["SCHEDULED", "SENDING"] } },
        data: { status: "CANCELLED" },
      }),
    ]);
    await addSuppression({
      organizationId: target.organizationId,
      email: target.email,
      reason: "UNSUBSCRIBE",
      source: "unsubscribe_page",
    });
    // The same person may already hold a closing link in this workspace
    await stopClosingSide(target.organizationId, target.email, reason);
    return true;
  }

  const { prospect } = target;
  const reason = getNamespaceTranslator(toUiLocale(prospect.link.createdBy?.locale), "server.followups.dispatch")(
    "unsubscribed",
  );
  await stopClosingSide(target.organizationId, prospect.email, reason);
  await addSuppression({
    organizationId: target.organizationId,
    email: prospect.email,
    reason: "UNSUBSCRIBE",
    source: "unsubscribe_page",
  });

  if (prospect.origin === "PROSPECTING") {
    const suggestion = await prisma.prospectSuggestion.findFirst({
      where: { linkId: prospect.linkId },
      select: { provider: true, externalId: true, linkedinUrl: true, dedupeKey: true },
    });
    await addOptOut(
      {
        email: prospect.email,
        linkedinUrl: suggestion?.linkedinUrl,
        provider: suggestion?.provider,
        externalId: suggestion?.externalId,
        personHash: suggestion?.dedupeKey,
      },
      "unsubscribe",
    );
  }
  return true;
}
