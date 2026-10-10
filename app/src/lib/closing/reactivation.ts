import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

import { formatDeadline } from "./expiry";
import { reactivatedEmail } from "./i18n/reactivated-email";
import { sendProspectEmail } from "./prospect-email";
import { defaultTimezone } from "./settings";

/**
 * The seller opened an expired link again: everyone who asked for more time
 * since `since` (the old deadline) hears about it. Returns how many were told.
 *
 * Only people the seller sent the link to, or who read it before it locked:
 * an email typed on the locked page proves nothing, and must not make us
 * write to a stranger.
 */
export async function notifyReactivated(linkId: string, since: Date) {
  if (!isEmailConfigured()) return 0;

  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      slug: true,
      expiresAt: true,
      document: { select: { name: true } },
      createdBy: { select: { email: true, name: true } },
      organization: { select: { settings: { select: { senderName: true } } } },
      actions: {
        where: {
          type: "REQUEST_EXTENSION",
          createdAt: { gte: since },
          prospect: {
            unsubscribedAt: null,
            OR: [{ origin: "SELLER" }, { views: { some: { isBot: false, startedAt: { lt: since } } } }],
          },
        },
        select: { prospect: { select: { id: true, email: true, locale: true, timezone: true } } },
      },
    },
  });
  if (!link) return 0;

  const prospects = new Map(link.actions.flatMap((a) => (a.prospect ? [[a.prospect.id, a.prospect] as const] : [])));
  const senderName = link.organization.settings?.senderName?.trim() || link.createdBy?.name || null;
  const url = `${getPublicAppUrl()}/v/${link.slug}`;

  let told = 0;
  for (const prospect of prospects.values()) {
    const locale = prospect.locale ?? "fr";
    const deadline = link.expiresAt
      ? formatDeadline(link.expiresAt, locale, prospect.timezone ?? defaultTimezone(), { showZone: !prospect.timezone })
      : null;
    try {
      await sendProspectEmail({
        prospect,
        locale,
        ...reactivatedEmail(locale, { documentName: link.document.name, senderName, deadline, url }),
        replyTo: link.createdBy?.email,
      });
      told++;
    } catch (error) {
      console.error("reactivation email", error);
    }
  }
  return told;
}
