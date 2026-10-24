import type { ProspectActionType } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { toUiLocale } from "@/lib/seller-locale";

import { formatDeadline } from "./expiry";
import { reactivatedEmail } from "./i18n/reactivated-email";
import { shareLink } from "./link-url";
import { sendProspectEmail } from "./prospect-email";
import { defaultTimezone } from "./settings";

/**
 * The seller opened a dead link again: everyone who asked for it since `since`
 * (the old deadline, or the day it was archived) hears about it. Returns the
 * prospects told.
 *
 * Only people the seller sent the link to, or who read it before it locked:
 * an email typed on the locked page proves nothing, and must not make us
 * write to a stranger.
 */
export async function notifyReactivated(
  linkId: string,
  since: Date,
  types: ProspectActionType[] = ["REQUEST_EXTENSION"],
): Promise<string[]> {
  if (!isEmailConfigured()) return [];

  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      slug: true,
      expiresAt: true,
      document: { select: { name: true, displayTitle: true, docType: true } },
      createdBy: { select: { email: true, name: true, locale: true } },
      organization: { select: { settings: { select: { senderName: true } } } },
      actions: {
        where: {
          type: { in: types },
          createdAt: { gte: since },
          prospect: {
            unsubscribedAt: null,
            bouncedAt: null,
            OR: [{ origin: "SELLER" }, { views: { some: { isBot: false, startedAt: { lt: since } } } }],
          },
        },
        select: { prospect: { select: { id: true, email: true, locale: true, timezone: true } } },
      },
    },
  });
  if (!link) return [];

  const prospects = new Map(link.actions.flatMap((a) => (a.prospect ? [[a.prospect.id, a.prospect] as const] : [])));
  const senderName = link.organization.settings?.senderName?.trim() || link.createdBy?.name || null;
  const share = shareLink(getPublicAppUrl(), link);

  const told: string[] = [];
  for (const prospect of prospects.values()) {
    // Unknown prospect language: the seller's, not French by default
    const locale = prospect.locale ?? toUiLocale(link.createdBy?.locale);
    const deadline = link.expiresAt
      ? formatDeadline(link.expiresAt, locale, prospect.timezone ?? defaultTimezone(), { showZone: !prospect.timezone })
      : null;
    try {
      await sendProspectEmail({
        prospect,
        locale,
        ...reactivatedEmail(locale, { documentName: link.document.name, senderName, deadline, url: share.url }),
        replyTo: link.createdBy?.email,
        link: share,
      });
      told.push(prospect.id);
    } catch (error) {
      console.error("reactivation email", error);
    }
  }
  return told;
}
