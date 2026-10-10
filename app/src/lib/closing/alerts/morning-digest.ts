import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { isOwnerRole } from "@/lib/roles";

import { DAY_MS } from "../constants";
import { dealAction } from "../dashboard/deal-action";
import { prospectLabel } from "../dashboard/labels";
import { describeNextAction, isUrgent } from "../dashboard/next-action";
import { getOpenDeals, sellerLinks, type SellerScope } from "../dashboard/queries";
import { compareDeals } from "../dashboard/rank";
import { formatDeadline } from "../expiry";
import { DEFAULT_PREFS } from "../notify/policy";
import { sellerTimezone } from "../notify/preferences";
import { buildDigest, DIGEST_TODO_MAX, isDigestDue, MAX_LOOKBACK_MS, sinceLabel, type DigestData } from "./digest-content";

/** A digest still not sent this long after being claimed is tried again. */
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000;
const EXPIRING_SOON_MS = 36 * 60 * 60 * 1000;

/**
 * Once a working day, at the hour each seller chose (their time zone): the
 * morning email. Every member gets their own, about their own links.
 */
export async function sendMorningDigests(now = new Date()) {
  if (!isEmailConfigured()) return 0;

  const members = await prisma.member.findMany({
    select: {
      userId: true,
      organizationId: true,
      role: true,
      user: {
        select: {
          email: true,
          notificationPreferences: { select: { organizationId: true, morningDigest: true, digestHour: true, timezone: true, lastDigestAt: true, digestClaimedAt: true } },
        },
      },
      organization: { select: { settings: { select: { autonomy: true } } } },
    },
  });

  let sent = 0;
  for (const member of members) {
    const row = member.user.notificationPreferences.find((p) => p.organizationId === member.organizationId);
    const prefs = {
      morningDigest: row?.morningDigest ?? DEFAULT_PREFS.morningDigest,
      digestHour: row?.digestHour ?? DEFAULT_PREFS.digestHour,
      timezone: sellerTimezone({ timezone: row?.timezone ?? null }),
    };
    if (!isDigestDue(prefs, row?.lastDigestAt ?? null, now)) continue;
    if (row?.digestClaimedAt && now.getTime() - row.digestClaimedAt.getTime() < CLAIM_TIMEOUT_MS) continue;

    // Claimed first: two ticks running at once must not send it twice
    const key = { userId_organizationId: { userId: member.userId, organizationId: member.organizationId } };
    await prisma.notificationPreference.upsert({ where: key, create: { ...key.userId_organizationId }, update: {} });
    const claimed = await prisma.notificationPreference.updateMany({
      where: {
        userId: member.userId,
        organizationId: member.organizationId,
        OR: [{ digestClaimedAt: null }, { digestClaimedAt: { lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } }],
      },
      data: { digestClaimedAt: now },
    });
    if (claimed.count === 0) continue;

    try {
      const since = new Date(Math.max(row?.lastDigestAt?.getTime() ?? now.getTime() - DAY_MS, now.getTime() - MAX_LOOKBACK_MS));
      const data = await loadDigestData(
        member.organizationId,
        { userId: member.userId, isOwner: isOwnerRole(member.role) },
        member.organization.settings?.autonomy === "AUTOPILOT",
        since,
        now,
        prefs.timezone,
      );
      const digest = buildDigest(data);
      if (digest) {
        await sendEmail({ to: member.user.email, subject: digest.subject, html: digest.html, text: digest.text });
        sent++;
      }
      // Nothing to say counts as done for today too
      await prisma.notificationPreference.update({ where: key, data: { lastDigestAt: now, digestClaimedAt: null } });
    } catch (error) {
      // The claim stays: tried again once it times out
      console.error(`[digest] not sent to ${member.userId} in ${member.organizationId}`, error);
    }
  }
  return sent;
}

async function loadDigestData(
  organizationId: string,
  scope: SellerScope,
  autopilot: boolean,
  since: Date,
  now: Date,
  timezone: string,
): Promise<DigestData> {
  const appUrl = getPublicAppUrl();
  const mine = { organizationId, ...sellerLinks(scope) };

  const linkLabel = { select: { name: true, slug: true, prospects: { orderBy: { createdAt: "asc" }, take: 1, select: { name: true, email: true, company: true } } } } as const;
  const [deals, actions, questions, readers, followupsSent, followupsFailed, unsubscribed, autoSent, drafts, expiring] = await Promise.all([
    getOpenDeals(organizationId, { owner: scope }),
    prisma.prospectAction.findMany({
      where: { createdAt: { gte: since }, link: mine },
      orderBy: { createdAt: "asc" },
      select: { type: true, message: true, linkId: true, createdAt: true, link: linkLabel },
    }),
    // Questions the assistant could not answer and promised the seller would
    prisma.chatMessage.findMany({
      where: { role: "USER", escalated: true, createdAt: { gte: since }, link: mine, view: { fromSeller: false } },
      orderBy: { createdAt: "asc" },
      select: { content: true, linkId: true, createdAt: true, link: linkLabel },
    }),
    prisma.documentView.groupBy({ by: ["linkId"], where: { isBot: false, startedAt: { gte: since }, link: mine } }),
    prisma.followup.count({ where: { status: { in: ["SENT", "DELIVERED"] }, sentAt: { gte: since }, link: mine } }),
    prisma.followup.count({ where: { status: "FAILED", updatedAt: { gte: since }, link: mine } }),
    prisma.prospect.count({ where: { unsubscribedAt: { gte: since }, link: mine } }),
    autopilot
      ? prisma.followup.findMany({
          where: { status: { in: ["SENT", "DELIVERED"] }, sentVia: "PLATFORM", approvedAt: null, sentAt: { gte: since }, link: mine },
          orderBy: { sentAt: "asc" },
          select: { subject: true, linkId: true, prospect: { select: { name: true, email: true, company: true } } },
        })
      : [],
    prisma.followup.count({ where: { status: "DRAFT", link: { ...mine, archivedAt: null } } }),
    // Also catches the J-1 alerts held back overnight or over the weekend
    prisma.link.findMany({
      where: {
        ...mine,
        archivedAt: null,
        draftAt: null,
        dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] },
        expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRING_SOON_MS) },
      },
      orderBy: { expiresAt: "asc" },
      select: { id: true, expiresAt: true, document: { select: { name: true } }, ...linkLabel.select },
    }),
  ]);

  const todo = deals
    .map((deal) => ({ deal, lastActivityAt: deal.lastActivityAt, ...dealAction(deal, now, false) }))
    // Drafts have their own line; a change request is listed in the answers when it is fresh
    .filter((row) => isUrgent(row.action) && row.action.kind !== "review_draft")
    .sort(compareDeals)
    .slice(0, DIGEST_TODO_MAX)
    .map((row) => ({
      label: prospectLabel(row.deal),
      documentName: row.deal.document.name,
      why: row.insightHeadline ?? describeNextAction(row.action, now),
      url: `${appUrl}/links/${row.deal.id}`,
    }));

  return {
    appUrl,
    sinceLabel: sinceLabel(since, now, timezone),
    todo,
    actions: [
      ...actions.map((a) => ({
        at: a.createdAt,
        label: prospectLabel(a.link),
        kind: ({ VALIDATE_SIGN: "validated", REQUEST_CHANGE: "change", REQUEST_EXTENSION: "extension" } as const)[a.type],
        message: a.message,
        url: `${appUrl}/links/${a.linkId}`,
      })),
      ...questions.map((q) => ({
        at: q.createdAt,
        label: prospectLabel(q.link),
        kind: "question" as const,
        message: q.content,
        url: `${appUrl}/links/${q.linkId}#questions`,
      })),
    ]
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((action) => ({ label: action.label, kind: action.kind, message: action.message, url: action.url })),
    counts: { readers: readers.length, followupsSent, followupsFailed, unsubscribed },
    autoSent: autoSent.map((f) => ({
      label: f.prospect.company ?? f.prospect.name ?? f.prospect.email,
      subject: f.subject,
      url: `${appUrl}/links/${f.linkId}`,
    })),
    drafts,
    expiring: expiring.map((link) => ({
      label: prospectLabel(link),
      documentName: link.document.name,
      when: formatDeadline(link.expiresAt!, "fr-FR", timezone),
      url: `${appUrl}/links/${link.id}#expiration`,
    })),
  };
}
