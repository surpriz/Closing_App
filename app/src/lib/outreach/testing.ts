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

const MAX_SIMULATED_SECONDS = 3600;
const boundedSeconds = (value: number) => Math.max(0, Math.min(MAX_SIMULATED_SECONDS, Math.round(Number.isFinite(value) ? value : 0)));
/** Old enough for the catch-up, which waits until a reading has settled. */
const SETTLED_MS = 6 * 60 * 1000;

/**
 * Test helper: records a human reading on an enrollment's link. The pricing page (first PRICING-tagged one, else
 * page 1) gets `pricingSeconds`, the rest of `totalSeconds` goes to page 1 or the next page. False without a link.
 */
export async function simulateReading(
  enrollmentId: string,
  input: { pricingSeconds: number; totalSeconds: number },
  now: Date = new Date(),
): Promise<boolean> {
  const pricingMs = boundedSeconds(input.pricingSeconds) * 1000;
  const totalMs = Math.max(pricingMs, boundedSeconds(input.totalSeconds) * 1000);
  const enrollment = await prisma.campaignProspect.findUnique({
    where: { id: enrollmentId },
    select: { linkId: true, prospectId: true, link: { select: { documentId: true } } },
  });
  if (!enrollment?.linkId || !enrollment.link) return false;
  const { linkId } = enrollment;

  const pricingPage = await prisma.documentPage.findFirst({
    where: { documentId: enrollment.link.documentId, tags: { has: "PRICING" } },
    orderBy: { pageNumber: "asc" },
    select: { pageNumber: true },
  });
  const pricingNumber = pricingPage?.pageNumber ?? 1;
  const otherNumber = pricingNumber === 1 ? 2 : 1;
  const otherMs = totalMs - pricingMs;
  const settledAt = new Date(now.getTime() - SETTLED_MS);
  const startedAt = new Date(settledAt.getTime() - totalMs);

  const view = await prisma.documentView.create({
    data: {
      linkId,
      documentId: enrollment.link.documentId,
      prospectId: enrollment.prospectId,
      visitorId: `sim-${enrollmentId}-${now.getTime()}`,
      isBot: false,
      fromSeller: false,
      startedAt,
      lastSeenAt: settledAt,
      totalDurationMs: totalMs,
      maxPageReached: otherMs > 0 ? Math.max(pricingNumber, otherNumber) : pricingNumber,
    },
    select: { id: true },
  });
  const pages = [
    { pageNumber: pricingNumber, ms: pricingMs },
    ...(otherMs > 0 ? [{ pageNumber: otherNumber, ms: otherMs }] : []),
  ].filter((page) => page.ms > 0);
  if (pages.length > 0) {
    await prisma.pageView.createMany({
      data: pages.map((page) => ({
        viewId: view.id,
        linkId,
        pageNumber: page.pageNumber,
        totalDurationMs: page.ms,
        hits: Math.max(1, Math.round(page.ms / 5000)),
        maxScrollDepth: 1,
        firstSeenAt: startedAt,
        lastSeenAt: settledAt,
      })),
    });
  }
  await prisma.link.update({ where: { id: linkId }, data: { lastActivityAt: settledAt } });
  return true;
}
