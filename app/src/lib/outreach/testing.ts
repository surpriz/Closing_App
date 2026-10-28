import { prisma } from "@/lib/db";
import { shiftLinkBack } from "@/lib/closing/testing/time-travel";

const clampDays = (days: number) => Math.max(1, Math.min(60, Math.round(days)));

/**
 * Test helper: pretends `days` passed for one campaign enrollment by moving its
 * dates (and its messages', and its link's) back. Test tools only.
 */
export async function shiftEnrollmentBack(enrollmentId: string, days: number) {
  const d = clampDays(days);
  const [, , enrollment] = await prisma.$transaction([
    prisma.$executeRaw`UPDATE "campaign_messages" SET
      "scheduledFor" = "scheduledFor" - make_interval(days => ${d}::int),
      "sentAt" = "sentAt" - make_interval(days => ${d}::int),
      "sendingAt" = "sendingAt" - make_interval(days => ${d}::int),
      "createdAt" = "createdAt" - make_interval(days => ${d}::int)
      WHERE "enrollmentId" = ${enrollmentId}`,
    prisma.$executeRaw`UPDATE "campaign_prospects" SET
      "createdAt" = "createdAt" - make_interval(days => ${d}::int),
      "nextSendAt" = "nextSendAt" - make_interval(days => ${d}::int),
      "pausedAt" = "pausedAt" - make_interval(days => ${d}::int),
      "repliedAt" = "repliedAt" - make_interval(days => ${d}::int),
      "finishedAt" = "finishedAt" - make_interval(days => ${d}::int)
      WHERE "id" = ${enrollmentId}`,
    prisma.campaignProspect.findUnique({ where: { id: enrollmentId }, select: { linkId: true } }),
  ]);
  if (enrollment?.linkId) await shiftLinkBack(enrollment.linkId, d);
}

/** Test helper: makes a mailbox look `days` older so the send ramp-up can be tested. */
export async function shiftMailboxRampBack(mailboxId: string, days: number) {
  const d = clampDays(days);
  await prisma.$executeRaw`UPDATE "mailboxes" SET "rampStartedAt" = "rampStartedAt" - make_interval(days => ${d}::int)
    WHERE "id" = ${mailboxId}`;
}
