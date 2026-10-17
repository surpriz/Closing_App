import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  buildOnboardingEmail,
  dueOnboardingEmail,
  NUDGE_WINDOW_MS,
  ONBOARDING_EMAIL_KINDS,
  type OnboardingEmailKind,
} from "@/lib/onboarding-emails";
import { toUiLocale } from "@/lib/seller-locale";

import { customLinkName, linkLabelSelect } from "./dashboard/labels";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sellers still in their first days get at most one getting-started email per pass. */
export async function sendOnboardingEmails(now: Date) {
  if (!isEmailConfigured()) return 0;
  // A document dropped on day 7 can still get its "not sent" nudge two days later
  const members = await prisma.member.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - NUDGE_WINDOW_MS - 3 * DAY_MS) } },
    select: { userId: true, organizationId: true },
  });
  let sent = 0;
  for (const member of members) {
    try {
      if (await sendDueOnboardingEmail(member.userId, member.organizationId, now)) sent++;
    } catch (error) {
      console.error(`[onboarding-emails] ${member.userId} in ${member.organizationId}`, error);
    }
  }
  return sent;
}

/** Sends the email due for this seller, if any. Also called right after sign-up for the welcome. */
export async function sendDueOnboardingEmail(userId: string, organizationId: string, now = new Date()) {
  if (!isEmailConfigured()) return false;
  const mine = { organizationId, createdById: userId, isOnboardingTest: false };
  const [member, prefs, sentRows, firstDocument, sentLink, firstRead] = await Promise.all([
    prisma.member.findFirst({
      where: { userId, organizationId },
      select: { createdAt: true, user: { select: { email: true, name: true, locale: true } } },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { onboardingEmailsOff: true },
    }),
    prisma.onboardingEmail.findMany({ where: { userId, organizationId }, select: { kind: true } }),
    prisma.document.findFirst({
      where: { organizationId, ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.link.findFirst({ where: { ...mine, draftAt: null }, select: { id: true } }),
    prisma.documentView.findFirst({
      where: { isBot: false, link: mine },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true, link: { select: linkLabelSelect } },
    }),
  ]);
  if (!member) return false;

  const sent = new Set(
    sentRows.map((row) => row.kind).filter((kind): kind is OnboardingEmailKind =>
      (ONBOARDING_EMAIL_KINDS as readonly string[]).includes(kind),
    ),
  );
  const kind = dueOnboardingEmail(
    {
      joinedAt: member.createdAt,
      sent,
      off: prefs?.onboardingEmailsOff ?? false,
      firstDocumentAt: firstDocument?.createdAt ?? null,
      hasSentLink: !!sentLink,
      firstReadAt: firstRead?.startedAt ?? null,
    },
    now,
  );
  if (!kind) return false;

  // Claimed first: two passes at once must not send it twice
  const claimed = await prisma.onboardingEmail
    .create({ data: { userId, organizationId, kind, sentAt: now }, select: { id: true } })
    .catch(() => null);
  if (!claimed) return false;

  const appUrl = getPublicAppUrl();
  const link = firstRead?.link;
  const email = buildOnboardingEmail(kind, {
    appUrl,
    firstName: member.user.name?.trim().split(/\s+/)[0] || null,
    locale: toUiLocale(member.user.locale),
    deal: link
      ? {
          label: link.prospects[0]?.company || link.prospects[0]?.name || customLinkName(link),
          url: `${appUrl}/links/${link.id}`,
        }
      : undefined,
  });
  try {
    await sendEmail({ to: member.user.email, ...email });
  } catch (error) {
    // Released: tried again on the next pass
    await prisma.onboardingEmail.delete({ where: { id: claimed.id } });
    throw error;
  }
  return true;
}
