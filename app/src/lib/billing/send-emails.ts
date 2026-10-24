import { getPublicAppUrl } from "@/lib/app-origin";
import { DAY_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { isOwnerRole } from "@/lib/roles";
import { toUiLocale } from "@/lib/seller-locale";

import { offerEndsAt } from "./offers";
import { BILLING_EMAIL_KINDS, buildBillingEmail, dueBillingEmail, type BillingEmailKind } from "./emails";
import { COMPED_STATUS, PAID_STATUSES } from "./plans";

const BATCH = 50;

async function owners(organizationId: string) {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { role: true, userId: true, user: { select: { email: true, name: true, locale: true } } },
  });
  return members.filter((member) => isOwnerRole(member.role));
}

/**
 * Claimed first (one row per owner and kind), released if the send fails.
 * Transactional: sent even to owners who turned the getting-started tips off.
 */
async function sendToOwners(organizationId: string, kind: BillingEmailKind, dedupeKind: string, endsAt: Date | null, now: Date, offer = false) {
  let sent = 0;
  for (const owner of await owners(organizationId)) {
    const claimed = await prisma.onboardingEmail
      .create({ data: { userId: owner.userId, organizationId, kind: dedupeKind, sentAt: now }, select: { id: true } })
      .catch(() => null);
    if (!claimed) continue;
    const email = buildBillingEmail(kind, {
      appUrl: getPublicAppUrl(),
      firstName: owner.user.name?.trim().split(/\s+/)[0] || null,
      locale: toUiLocale(owner.user.locale),
      endsAt,
      offer,
      now,
    });
    try {
      await sendEmail({ to: owner.user.email, ...email });
      sent++;
    } catch (error) {
      await prisma.onboardingEmail.delete({ where: { id: claimed.id } });
      console.error(`[billing-emails] ${kind} to ${owner.userId}`, error);
    }
  }
  return sent;
}

/** Trials ending or just ended, and the beta coming to an end: at most one email per workspace per pass. */
export async function sendBillingEmails(now: Date) {
  if (!isEmailConfigured()) return 0;
  const { BETA_GRACE_UNTIL, BETA_NOTICE_DAYS } = getEnv();
  const betaGraceUntil = BETA_GRACE_UNTIL ?? null;
  const orgs = await prisma.organization.findMany({
    where: {
      suspendedAt: null,
      AND: [
        // Paying or granted a plan: nothing to announce
        { OR: [{ planStatus: null }, { planStatus: { notIn: [...PAID_STATUSES, COMPED_STATUS] } }] },
        {
          OR: [
            { trialEndsAt: { gte: new Date(now.getTime() - 4 * DAY_MS), lte: new Date(now.getTime() + 4 * DAY_MS) } },
            ...(betaGraceUntil ? [{ betaGrace: true }] : []),
          ],
        },
      ],
    },
    select: { id: true, trialEndsAt: true, offerCode: true, betaGrace: true, onboardingEmails: { where: { kind: { startsWith: "billing_" } }, select: { kind: true } } },
  });

  let sent = 0;
  let handled = 0;
  for (const org of orgs) {
    const kind = dueBillingEmail(
      {
        trialEndsAt: org.trialEndsAt,
        betaGrace: org.betaGrace,
        betaGraceUntil,
        noticeDays: BETA_NOTICE_DAYS,
        subscribed: false,
        sent: new Set(org.onboardingEmails.map((row) => row.kind).filter((k) => (BILLING_EMAIL_KINDS as readonly string[]).includes(k))),
      },
      now,
    );
    if (!kind) continue;
    const endsAt = kind.startsWith("billing_beta") ? betaGraceUntil : org.trialEndsAt;
    sent += await sendToOwners(org.id, kind, kind, endsAt, now, offerEndsAt(org, now) !== null);
    if (++handled >= BATCH) break;
  }
  return sent;
}

/** From the webhook: one email per failed invoice, to the owners. */
export async function sendPaymentFailedEmail(organizationId: string, invoiceId: string, now = new Date()) {
  if (!isEmailConfigured()) return 0;
  return sendToOwners(organizationId, "billing_payment_failed", `billing_payment_failed:${invoiceId}`, null, now);
}
