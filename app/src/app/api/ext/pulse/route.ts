import { getPublicAppUrl } from "@/lib/app-origin";
import { prospectLabel } from "@/lib/closing/dashboard/labels";
import { getWorkspaceLiveState } from "@/lib/closing/live";
import { extensionNotice } from "@/lib/closing/notify/extension-notice";
import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import { withExtensionAuth } from "@/lib/extension-auth";
import { extensionRemoteConfig } from "@/lib/extension-config";
import { isOwnerRole } from "@/lib/roles";

/** A first poll, or one after a long sleep, only replays this much. */
const MAX_REPLAY_MS = 10 * 60 * 1000;
/** extensionSeenAt is written at most this often. */
const SEEN_EVERY_MS = 60 * 1000;

/**
 * Polled by the extension every 30 s: who is reading the seller's proposals
 * right now (badge), and the alerts meant for the extension since `since`
 * (Chrome notifications). Also tells the server the extension is running, so
 * call moments are not emailed on top.
 */
export const GET = withExtensionAuth(async (request, { user, organization }) => {
  const now = new Date();
  if (!extensionRemoteConfig().notificationsEnabled) {
    return Response.json({ enabled: false, readers: [], alerts: [], next: now.toISOString() });
  }

  const param = new URL(request.url).searchParams.get("since");
  const parsed = param ? new Date(param) : null;
  const floor = now.getTime() - MAX_REPLAY_MS;
  const since = new Date(Math.max(parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : floor, floor));

  const [member, prefs] = await Promise.all([
    prisma.member.findFirst({ where: { userId: user.id, organizationId: organization.id }, select: { role: true } }),
    prisma.notificationPreference.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      select: { extensionSeenAt: true },
    }),
  ]);
  const owner = { userId: user.id, isOwner: isOwnerRole(member?.role ?? "") };

  const [live, alerts] = await Promise.all([
    getWorkspaceLiveState(organization.id, now, owner),
    prisma.sellerAlert.findMany({
      where: {
        userId: user.id,
        link: { organizationId: organization.id },
        createdAt: { gt: since },
        channels: { has: "EXTENSION" },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        type: true,
        priority: true,
        payload: true,
        createdAt: true,
        link: { select: { id: true, name: true, slug: true, prospects: { orderBy: { createdAt: "asc" }, take: 1, select: { name: true, email: true, company: true } }, document: { select: { name: true } } } },
      },
    }),
  ]);

  if (!prefs?.extensionSeenAt || now.getTime() - prefs.extensionSeenAt.getTime() > SEEN_EVERY_MS) {
    await upsertSellerPrefs(user.id, organization.id, { extensionSeenAt: now });
  }

  const appUrl = getPublicAppUrl();
  return Response.json({
    enabled: true,
    readers: live.readers.map((reader) => ({
      viewId: reader.viewId,
      linkId: reader.linkId,
      label: reader.label,
      name: reader.name,
      currentPage: reader.currentPage,
      startedAt: reader.startedAt,
    })),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      priority: alert.priority,
      linkId: alert.link.id,
      url: `${appUrl}/links/${alert.link.id}`,
      createdAt: alert.createdAt.toISOString(),
      ...extensionNotice(alert.type, prospectLabel(alert.link), alert.link.document.name, (alert.payload ?? {}) as object),
    })),
    next: (alerts.at(-1)?.createdAt ?? since).toISOString(),
  });
});
