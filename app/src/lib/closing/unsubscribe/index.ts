import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";

import { createUnsubscribeToken, verifyUnsubscribeToken } from "./token";

// ENCRYPTION_KEY never rotates (it would make stored secrets unreadable),
// so links already sent keep working.
function unsubscribeSecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  }
  return secret;
}

export function unsubscribeToken(prospectId: string) {
  return createUnsubscribeToken(prospectId, unsubscribeSecret());
}

export function unsubscribePageUrl(prospectId: string) {
  return `${getPublicAppUrl()}/u/${unsubscribeToken(prospectId)}`;
}

// Target of the List-Unsubscribe header (RFC 8058 one-click POST)
export function unsubscribeOneClickUrl(prospectId: string) {
  return `${getPublicAppUrl()}/api/unsubscribe/${unsubscribeToken(prospectId)}`;
}

export async function findProspectByUnsubscribeToken(token: string) {
  const prospectId = verifyUnsubscribeToken(token, unsubscribeSecret());
  if (!prospectId) return null;
  return prisma.prospect.findUnique({
    where: { id: prospectId },
    select: {
      id: true,
      email: true,
      unsubscribedAt: true,
      link: { select: { organizationId: true } },
    },
  });
}

// Opts the address out of every proposal of the same workspace: a prospect
// who says stop means this sender, not just this one link.
export async function unsubscribeByToken(token: string) {
  const prospect = await findProspectByUnsubscribeToken(token);
  if (!prospect) return false;

  const now = new Date();
  const sameAddress = {
    email: { equals: prospect.email, mode: "insensitive" as const },
    link: { organizationId: prospect.link.organizationId },
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
      data: { status: "CANCELLED", cancelledAt: now, error: "Prospect désinscrit" },
    }),
  ]);
  return true;
}
