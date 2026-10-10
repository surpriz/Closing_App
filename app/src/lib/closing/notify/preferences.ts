import { prisma } from "@/lib/db";

import { defaultTimezone } from "../settings";
import { DEFAULT_PREFS, type SellerPrefs } from "./policy";

export type StoredPrefs = SellerPrefs & {
  extensionSeenAt: Date | null;
  onboardingCompletedAt: Date | null;
  mailClient: string | null;
};

/** A seller's notification settings in one workspace. No row = defaults. */
export async function getSellerPrefs(userId: string, organizationId: string): Promise<StoredPrefs> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!row) return { ...DEFAULT_PREFS, extensionSeenAt: null, onboardingCompletedAt: null, mailClient: null };
  return {
    emailActions: row.emailActions,
    emailCallMoments: row.emailCallMoments,
    extensionCallMoments: row.extensionCallMoments,
    morningDigest: row.morningDigest,
    digestHour: row.digestHour,
    timezone: row.timezone,
    extensionSeenAt: row.extensionSeenAt,
    onboardingCompletedAt: row.onboardingCompletedAt,
    mailClient: row.mailClient,
  };
}

export function sellerTimezone(prefs: Pick<SellerPrefs, "timezone">) {
  return prefs.timezone ?? defaultTimezone();
}

export function upsertSellerPrefs(
  userId: string,
  organizationId: string,
  data: Partial<SellerPrefs> & { extensionSeenAt?: Date; onboardingCompletedAt?: Date; mailClient?: string },
) {
  return prisma.notificationPreference.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: { userId, organizationId, ...data },
    update: data,
  });
}

/**
 * Seller an alert about this link is for: whoever created it, otherwise the
 * workspace owner (links made before members, or by a removed member).
 */
export async function resolveRecipient(link: { createdById: string | null; organizationId: string }) {
  if (link.createdById) {
    const member = await prisma.member.findFirst({
      where: { organizationId: link.organizationId, userId: link.createdById },
      select: { user: { select: { id: true, email: true, name: true } } },
    });
    if (member) return member.user;
  }
  const owner = await prisma.member.findFirst({
    where: { organizationId: link.organizationId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  return owner?.user ?? null;
}
