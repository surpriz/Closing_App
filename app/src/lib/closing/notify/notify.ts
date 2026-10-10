import type { SellerAlertType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { createAndDeliverAlert, type AlertPayload } from "../alerts/send-alert";
import { ALERT_PRIORITY, decideChannels, isExtensionActive } from "./policy";
import { getSellerPrefs, resolveRecipient, sellerTimezone } from "./preferences";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Single entry point for telling a seller something: finds who the link
 * belongs to, applies their preferences and the anti-noise rules, then stores
 * and delivers the alert. Returns false when it was a duplicate.
 *
 * `silent` stores the alert without pushing it anywhere: it shows in the
 * timeline and uses up its dedupe key.
 */
export async function notifySeller(input: {
  linkId: string;
  type: SellerAlertType;
  dedupeKey: string;
  payload: AlertPayload;
  now?: Date;
  silent?: boolean;
  /** Out of working hours, store nothing: the caller asks again on its next pass. */
  deferOutsideWorkingHours?: boolean;
}) {
  const now = input.now ?? new Date();
  const link = await prisma.link.findUnique({
    where: { id: input.linkId },
    select: {
      createdById: true,
      organizationId: true,
      organization: { select: { settings: { select: { alertChannels: true, alertEmail: true } } } },
    },
  });
  if (!link) return false;

  const recipient = await resolveRecipient(link);
  const prefs = recipient ? await getSellerPrefs(recipient.id, link.organizationId) : null;
  const priority = ALERT_PRIORITY[input.type];

  const recentCallAlerts =
    recipient && priority === "CALL" && !input.silent
      ? await prisma.sellerAlert.count({
          where: { userId: recipient.id, priority: "CALL", createdAt: { gte: new Date(now.getTime() - HOUR_MS) }, NOT: { channels: { isEmpty: true } } },
        })
      : 0;

  const decision = input.silent
    ? { channels: [], reason: "muted" as const }
    : prefs
    ? decideChannels({
        type: input.type,
        prefs,
        workspaceChannels: link.organization.settings?.alertChannels ?? [],
        now,
        timezone: sellerTimezone(prefs),
        extensionActive: isExtensionActive(prefs.extensionSeenAt, now),
        recentCallAlerts,
      })
    : { channels: [], reason: "muted" as const };
  if (input.deferOutsideWorkingHours && decision.reason === "quiet_hours") return false;

  // Stored even with no channel: it still shows in the dashboard feed
  return createAndDeliverAlert({
    linkId: input.linkId,
    type: input.type,
    dedupeKey: input.dedupeKey,
    payload: input.payload,
    channels: decision.channels,
    priority,
    userId: recipient?.id ?? null,
    recipientEmail: recipient?.email ?? null,
    copyTo: priority === "INFO" ? null : (link.organization.settings?.alertEmail ?? null),
    timezone: prefs ? sellerTimezone(prefs) : undefined,
  });
}
