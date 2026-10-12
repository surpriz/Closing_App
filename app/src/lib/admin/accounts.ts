import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/platform-admin";

/** Extension and Outlook tokens are sessions too. */
export function revokeExtensionTokens(userId: string) {
  return prisma.extensionToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** No account can be created with this email any more. */
export function blockEmailAddress(email: string, reason: string | null, adminId: string) {
  const normalized = normalizeEmail(email);
  return prisma.blockedEmail.upsert({
    where: { email: normalized },
    create: { email: normalized, reason, createdById: adminId },
    update: { reason, createdById: adminId },
  });
}

export function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } }, select: { id: true } });
}
