import { getLocale, getTranslations } from "next-intl/server";

import type { TimelineItem } from "@/components/dashboard/activity-timeline";
import type { TranscriptConversation } from "@/components/dashboard/chat-transcript";
import {
  toFollowupItem,
  type FollowupItem,
} from "@/components/dashboard/followup-item";
import type { LabelsT } from "@/components/dashboard/labels";
import type { LinkCapsuleRow } from "@/components/dashboard/link-capsules";
import type { PageTimeDatum } from "@/components/dashboard/page-time-chart";
import type { SharedReader } from "@/components/dashboard/shared-readers";
import type { VoiceCommentItem } from "@/components/dashboard/voice-comments";
import type { ViewSignalType } from "@/generated/prisma/enums";
import type { UiLocale } from "@/i18n/locale";
import { getAppOrigin } from "@/lib/app-origin";
import { sellerBookingUrl } from "@/lib/closing/booking/link-booking";
import { getLatestInsight } from "@/lib/closing/brain/latest";
import {
  capsulesVisibleOnLink,
  resolveCapsules,
  WELCOME_PAGE,
} from "@/lib/closing/capsules/resolve";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { DAY_MS } from "@/lib/closing/constants";
import { getReaderMap } from "@/lib/closing/committee/queries";
import { getLinkAnalytics } from "@/lib/closing/analytics";
import { dealCta } from "@/lib/closing/dashboard/deal-cta";
import { dealPlates } from "@/lib/closing/dashboard/deal-plates";
import { ACTION_KIND } from "@/lib/closing/dashboard/feed";
import { dealLabel } from "@/lib/closing/dashboard/labels";
import {
  computeNextAction,
  withAiAdvice,
  type OpenDealStatus,
} from "@/lib/closing/dashboard/next-action";
import {
  canEditDeal,
  CONTACT_ACTIVITY_TYPES,
  PLANNED_FOLLOWUP_STATUSES,
} from "@/lib/closing/dashboard/queries";
import { labelReaders } from "@/lib/closing/dashboard/readers";
import { showsReadingDetail } from "@/lib/closing/dashboard/reading-detail";
import { videoProvider } from "@/lib/closing/documents/web-link";
import { VIDEO_SEGMENTS } from "@/lib/closing/documents/video-segments";
import { hasReason } from "@/lib/closing/engagement/reasons";
import {
  actionsByProspect,
  buildForwardTree,
  FORWARD_ACTION,
} from "@/lib/closing/forward/tree";
import { freshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { getLinkLiveState } from "@/lib/closing/live";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { rankSharedReaders } from "@/lib/closing/shared/hot-readers";
import { readingByLink } from "@/lib/closing/shared/reading-time";
import { languageName } from "@/lib/closing/translation/translation";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { ARCHIVE_GRACE_DAYS } from "@/lib/closing/retention/purge";
import { canDraftInterestFollowup, deadState, REVIVAL_ALERT_TYPES, revivalSignal } from "@/lib/closing/revival";
import type { EngagementReason } from "@/lib/closing/types";
import { prisma } from "@/lib/db";
import { formatDate, formatDuration, formatRelative } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import type { requireWorkspace } from "@/lib/session";

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;
type LoadDealT = Awaited<ReturnType<typeof getTranslations<"deal.loadDeal">>>;

/**
 * Everything the deal page shows about one link, read and shaped on the
 * server. Null when the link is not in this workspace. An archived link still
 * opens: the prospect may come back to it, and the seller reopens it here.
 */
export async function loadDeal(
  id: string,
  workspace: Workspace,
  justCreated: boolean,
) {
  const { organization } = workspace;
  const [t, tl, tRoot, locale] = await Promise.all([
    getTranslations("deal.loadDeal"),
    getTranslations("labels"),
    getTranslations(),
    getLocale(),
  ]);

  const link = await prisma.link.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          archivedAt: true,
          kind: true,
          embedUrl: true,
          status: true,
          docType: true,
          displayTitle: true,
          aiProcessedAt: true,
          durationMs: true,
          numPages: true,
          pages: {
            select: { pageNumber: true, tags: true, summary: true },
            orderBy: { pageNumber: "asc" },
          },
        },
      },
      prospects: { orderBy: { createdAt: "asc" } },
      engagementScore: true,
      parentLink: { select: { id: true, name: true } },
    },
  });
  if (!link) return null;

  // A teammate's deal opens read-only: its seller and the managers make the calls
  const canEdit = canEditDeal(link.createdById, workspace);
  const seller =
    !canEdit && link.createdById
      ? await prisma.user.findUnique({
          where: { id: link.createdById },
          select: { name: true, email: true },
        })
      : null;

  const score = await freshEngagementScore(link.id, link.engagementScore);
  catchUpInBackground({
    organizationId: organization.id,
    linkId: link.id,
    documentId: link.document.id,
  });
  // The seller came to look: how long the alerts that called for them waited (team reaction time)
  await prisma.sellerAlert.updateMany({
    where: { linkId: link.id, userId: workspace.user.id, seenAt: null, priority: { in: ["ACTION", "CALL"] } },
    data: { seenAt: new Date() },
  });

  const [
    analytics,
    settings,
    origin,
    followups,
    alerts,
    actions,
    live,
    sellerActivities,
    insight,
    readerMap,
    chatRows,
    capsuleRows,
    capsulePlays,
    voiceRows,
    forwards,
    prospectPages,
    revivalAlert,
  ] = await Promise.all([
    getLinkAnalytics(link.id),
    getWorkspaceSettings(organization.id),
    getAppOrigin(),
    prisma.followup.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { prospect: { select: { name: true, email: true } } },
    }),
    // Prospect actions and forwarded questions have their own timeline entries
    prisma.sellerAlert.findMany({
      where: {
        linkId: link.id,
        type: {
          notIn: [
            "PROSPECT_VALIDATED",
            "CHANGE_REQUESTED",
            "QUOTE_REQUESTED",
            "MEETING_BOOKED",
            "PROSPECT_QUESTION",
            "LINK_EXTENSION_REQUESTED",
            "VOICE_COMMENT",
            "DOCUMENT_FORWARDED",
            "PROSPECT_REPLIED",
            "RELINK_REQUESTED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.prospectAction.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { prospect: { select: { name: true, email: true } } },
    }),
    getLinkLiveState(link.id),
    prisma.sellerActivity.findMany({
      where: { linkId: link.id },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    getLatestInsight(link.id),
    getReaderMap(link.id, undefined, locale),
    // The seller testing their own link is left out
    prisma.chatMessage.findMany({
      where: { linkId: link.id, view: { fromSeller: false } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        role: true,
        content: true,
        escalated: true,
        flags: true,
        createdAt: true,
        view: {
          select: {
            visitorId: true,
            email: true,
            prospect: { select: { name: true, email: true } },
          },
        },
      },
    }),
    // The document's capsules and this link's own, with the plays of this link only
    prisma.pageCapsule.findMany({
      where: capsulesVisibleOnLink(link),
      select: {
        id: true,
        pageNumber: true,
        linkId: true,
        kind: true,
        hookText: true,
        durationMs: true,
        _count: { select: { plays: { where: { linkId: link.id } } } },
      },
    }),
    prisma.capsulePlay.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        pageNumber: true,
        createdAt: true,
        view: {
          select: {
            email: true,
            prospect: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.voiceComment.findMany({
      where: { linkId: link.id, view: { fromSeller: false } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        prospectId: true,
        pageNumber: true,
        status: true,
        transcript: true,
        durationMs: true,
        createdAt: true,
        view: {
          select: {
            email: true,
            prospect: { select: { name: true, email: true } },
          },
        },
      },
    }),
    // "Transférer": who passed it to whom, for the timeline and the circuit
    prisma.linkForward.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fromProspectId: true,
        toProspectId: true,
        message: true,
        createdAt: true,
        sentAt: true,
        error: true,
        fromProspect: { select: { name: true, email: true } },
        toProspect: { select: { name: true, email: true } },
      },
    }),
    // Time per page and per known person: the hottest pages of each node of the circuit
    prisma.pageView.findMany({
      where: { linkId: link.id, totalDurationMs: { gt: 0 }, view: { isBot: false, prospectId: { not: null } } },
      take: 2000,
      select: { pageNumber: true, totalDurationMs: true, view: { select: { prospectId: true } } },
    }),
    prisma.sellerAlert.findFirst({
      where: { linkId: link.id, type: { in: [...REVIVAL_ALERT_TYPES] } },
      orderBy: { createdAt: "desc" },
      select: { type: true, createdAt: true },
    }),
  ]);
  const insightRecipient = insight?.recommendedAction.prospectId
    ? link.prospects.find((p) => p.id === insight.recommendedAction.prospectId)
    : null;

  const mainProspect = link.prospects[0];
  const title = dealLabel(link, tRoot("today.page.noRecipient"));
  const url = `${origin}/v/${link.slug}`;
  const now = new Date();

  // Archived, or past its deadline: what the prospect gets is a locked page
  const dead = deadState(link, now);
  const revival = revivalSignal(dead, revivalAlert);
  // Bringing a document back is a manager's call, like archiving it
  const canReactivate = canEdit && !!dead && (!link.document.archivedAt || isManagerRole(workspace.role));
  const canDraftOnReactivate = canDraftInterestFollowup(link);
  // An archived document is deleted for good after the grace period: the seller should know the clock
  const purgeAt = link.document.archivedAt
    ? new Date(link.document.archivedAt.getTime() + ARCHIVE_GRACE_DAYS * DAY_MS)
    : null;

  // Just dropped, or not sent yet: the share screen leads the page
  const sharing = canEdit && !dead && (justCreated || !!link.draftAt);
  // The AI has not said what the document is yet: the settings may still follow it (a few seconds)
  const reading =
    link.document.status === "PROCESSING" ||
    (link.autoSettings &&
      !link.document.aiProcessedAt &&
      now.getTime() - link.createdAt.getTime() < 2 * 60_000);
  const sellerPrefs = sharing
    ? await getSellerPrefs(workspace.user.id, organization.id)
    : null;
  const sellerBooking = canEdit ? await sellerBookingUrl(link) : null;
  const settingsPanel = {
    linkId: link.id,
    booking: { url: link.bookingUrl ?? "", fallback: sellerBooking },
    initial: {
      requireEmail: link.requireEmail,
      ctaEnabled: link.ctaEnabled,
      bookingEnabled: link.bookingEnabled,
      chatEnabled: link.chatEnabled,
      voiceCommentsEnabled: link.voiceCommentsEnabled,
      translationEnabled: link.translationEnabled,
      forwardEnabled: link.forwardEnabled,
      followupsEnabled: link.followupsEnabled,
    },
    expiresAt: link.expiresAt?.toISOString() ?? null,
    requests: link.expiresAt
      ? actions.filter(
          (a) =>
            a.type === "REQUEST_EXTENSION" && a.createdAt >= link.expiresAt!,
        ).length
      : 0,
    kind: link.document.kind,
    shared: link.shared,
    canSaveDefaults: isManagerRole(workspace.role),
  };

  const statsByPage = new Map(analytics.pages.map((p) => [p.pageNumber, p]));
  const chartData: PageTimeDatum[] = link.document.pages.map((page) => {
    const stat = statsByPage.get(page.pageNumber);
    const total = stat?.totalDurationMs ?? 0;
    return {
      pageNumber: page.pageNumber,
      totalSeconds: Math.round(total / 1000),
      avgSeconds: stat?.viewCount
        ? Math.round(total / stat.viewCount / 1000)
        : 0,
      isPricing: page.tags.includes("PRICING"),
      summary: page.summary,
    };
  });

  const reasons = Array.isArray(score?.reasons)
    ? (score.reasons as unknown as EngagementReason[])
    : [];
  const opened = analytics.viewCount > 0;
  const readingNow = live.readers.length > 0;
  // Same rule as the "À traiter" row: the analysis has the last word when it is current
  const insightCurrent =
    !!insight &&
    (!link.lastActivityAt || insight.createdAt >= link.lastActivityAt);
  const openStatus = (["OPEN", "CHANGE_REQUESTED", "VALIDATED"] as const).find(
    (status) => status === link.dealStatus,
  );
  const nextAction = withAiAdvice(
    computeNextAction({
      now,
      dealStatus: (openStatus ?? "OPEN") as OpenDealStatus,
      readingNow,
      opened,
      tier: opened ? (score?.tier ?? null) : null,
      pricingFocus: hasReason(score?.reasons, "pricing_focus"),
      lastActivityAt: link.lastActivityAt,
      sentAt: link.sentAt ?? link.createdAt,
      followupsEnabled: link.followupsEnabled,
      nextFollowup:
        followups
          .filter((f) =>
            (PLANNED_FOLLOWUP_STATUSES as readonly string[]).includes(f.status),
          )
          .sort(
            (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime(),
          )[0] ?? null,
      draftToReview: followups.some((f) => f.status === "DRAFT"),
      lastSellerContactAt:
        sellerActivities.find(
          (a) => a.source === "MANUAL" && (CONTACT_ACTIVITY_TYPES as readonly string[]).includes(a.type),
        )?.occurredAt ?? null,
      repliedAt: link.repliedAt,
      gateSeenAt: link.gateSeenAt,
      snoozedUntil: link.snoozedUntil,
      meetingBookedAt: link.meetingBookedAt,
      meetingAt: link.meetingAt,
      quoteRequestedAt: link.quoteRequestedAt,
      revival,
    }),
    insightCurrent && insight
      ? {
          type: insight.recommendedAction.type,
          timing: insight.recommendedAction.timing,
          priority: insight.priority,
        }
      : null,
  );
  const aiAvailable = getLanguageModel("analyze") !== null;
  const draftWaiting = followups.some(
    (f) =>
      f.trigger === "AI_DECISION" &&
      (f.status === "DRAFT" || f.status === "PENDING"),
  );
  // A link that left the open states (won, lost) has nothing left to push
  const cta = openStatus
    ? dealCta(
        nextAction,
        {
        email: mainProspect?.email ?? null,
        phone: mainProspect?.phoneE164 ?? null,
        draftWaiting,
        canPrepareFollowup: aiAvailable && !!insight?.byAi,
        aiActionType:
          insightCurrent && insight ? insight.recommendedAction.type : null,
        },
        tRoot,
      )
    : null;
  const recipientName = (() => {
    const name = insightRecipient
      ? (insightRecipient.name ?? insightRecipient.email)
      : null;
    return name && name !== title ? name : null;
  })();

  const showsDetail = showsReadingDetail({
    kind: link.document.kind,
    durationMs: link.document.durationMs,
    viewCount: analytics.viewCount,
    pagesWithTime: chartData.filter((page) => page.totalSeconds > 0).length,
  });
  const isVideo = link.document.kind === "VIDEO";
  // Web pages have no pages to heat: no band for them
  const plates =
    link.document.kind === "URL"
      ? null
      : dealPlates({
          pages: analytics.pages,
          documentPages: chartData.map((page) => ({
            pageNumber: page.pageNumber,
            isPricing: page.isPricing,
            summary: page.summary ?? null,
          })),
          numPages: isVideo ? VIDEO_SEGMENTS : link.document.numPages,
          video: isVideo,
          locale,
          livePages: live.readers
            .map((reader) => reader.currentPage)
            .filter((page): page is number => !!page),
        });

  const conversations = new Map<string, TranscriptConversation>();
  for (const row of [...chatRows].reverse()) {
    const conversation = conversations.get(row.view.visitorId) ?? {
      visitorId: row.view.visitorId,
      reader:
        row.view.prospect?.name ??
        row.view.prospect?.email ??
        row.view.email ??
        t("anonymousReader"),
      messages: [],
    };
    conversation.messages.push(row);
    conversations.set(row.view.visitorId, conversation);
  }
  // Latest conversation first
  const transcript = [...conversations.values()].reverse();

  const readerName = (view: {
    email: string | null;
    prospect: { name: string | null; email: string } | null;
  }) =>
    view.prospect?.name ??
    view.prospect?.email ??
    view.email ??
    t("theProspect");
  const voiceComments: VoiceCommentItem[] = voiceRows.map((row) => ({
    ...row,
    reader: readerName(row.view),
  }));
  const capsuleSummary = (row: (typeof capsuleRows)[number]) => ({
    id: row.id,
    kind: row.kind,
    hookText: row.hookText,
    durationMs: row.durationMs,
    plays: row._count.plays,
  });
  const welcomeRows = capsuleRows.filter(
    (row) => row.pageNumber === WELCOME_PAGE,
  );
  const documentWelcomeRow = welcomeRows.find((row) => row.linkId === null);
  const linkWelcomeRow = welcomeRows.find((row) => row.linkId === link.id);
  // A video pitch is already the seller speaking: no welcome bubble on top
  const welcome =
    canEdit && !isVideo
      ? {
          documentWelcome: documentWelcomeRow
            ? capsuleSummary(documentWelcomeRow)
            : null,
          linkWelcome: linkWelcomeRow ? capsuleSummary(linkWelcomeRow) : null,
        }
      : null;
  // Recorded before the welcome message: still played on their page, no longer created
  const linkCapsules: LinkCapsuleRow[] = [
    ...resolveCapsules(
      capsuleRows.filter((row) => row.pageNumber !== WELCOME_PAGE),
      link.id,
    ).values(),
  ].map((row) => ({
    id: row.id,
    pageNumber: row.pageNumber,
    kind: row.kind,
    hookText: row.hookText,
    durationMs: row.durationMs,
    plays: row._count.plays,
    forLink: row.linkId === link.id,
  }));

  // Only the latest booking's slot is kept (Link.meetingAt)
  const latestBooking = actions.find(
    (action) => action.type === "MEETING_BOOKED",
  );
  const readerLabels = labelReaders(analytics.recentViews, (letter) =>
    tRoot("today.readers.unidentified", { letter }),
  );
  const isEmbeddedVideo =
    link.document.kind === "URL" &&
    videoProvider(link.document.embedUrl) !== null;
  const timeline: TimelineItem[] = [
    {
      id: `created-${link.id}`,
      at: link.createdAt,
      kind: "created" as const,
      title: t("linkCreated"),
    },
    ...analytics.recentViews.map((view) => ({
      id: `view-${view.id}`,
      at: view.startedAt,
      kind: "view" as const,
      title: t("readBy", {
        name: readerLabels.get(view.id)?.name ?? t("aReader"),
      }),
      detail: [
        formatDuration(view.totalDurationMs),
        link.document.kind === "URL"
          ? null
          : link.document.kind === "VIDEO"
            ? reachedDetail(t, view.maxPageReached)
            : t("upToPage", { page: view.maxPageReached }),
        link.document.kind === "URL"
          ? depthDetail(
              t,
              view.pageViews[0]?.maxScrollDepth ?? 0,
              isEmbeddedVideo,
            )
          : null,
        ...signalDetails(t, view.signals, locale),
        [view.deviceType, view.browser].filter(Boolean).join(" "),
        view.timezone,
      ]
        .filter(Boolean)
        .join(", "),
    })),
    ...actions.map((action) => ({
      id: `action-${action.id}`,
      at: action.createdAt,
      kind: ACTION_KIND[action.type],
      title: t(
        action.type === "VALIDATE_SIGN"
          ? action.signerName
            ? "actionSigned"
            : "actionValidated"
          : action.type === "REQUEST_EXTENSION"
            ? "actionExtension"
            : action.type === "REQUEST_RELINK"
              ? "actionRelink"
              : action.type === "MEETING_BOOKED"
                ? "actionMeeting"
                : action.type === "MEETING_CLICK"
                  ? "actionMeetingClick"
                  : action.type === "REQUEST_QUOTE"
                    ? "actionQuote"
                    : "actionChange",
        {
          name:
            action.signerName ??
            action.prospect?.name ??
            action.prospect?.email ??
            t("theProspect"),
        },
      ),
      detail: action.message
        ? t("quoted", { text: action.message })
        : action.id === latestBooking?.id && link.meetingAt
          ? t("meetingOn", { date: formatDate(link.meetingAt, locale) })
          : action.signerName && action.prospect?.email
            ? // The gate takes the reader's word: nothing proves they own that mailbox
              t("signerUnverified", { email: action.prospect.email })
            : null,
    })),
    ...chatRows
      .filter((row) => row.escalated)
      .map((row) => ({
        id: `question-${row.id}`,
        at: row.createdAt,
        kind: "question" as const,
        title: t("question", { name: readerName(row.view) }),
        detail: t("quoted", { text: row.content }),
      })),
    ...voiceComments.map((comment) => ({
      id: `voice-${comment.id}`,
      at: comment.createdAt,
      kind: "voice" as const,
      title: t("voice", { name: comment.reader, page: comment.pageNumber }),
      detail: comment.transcript
        ? t("quoted", { text: comment.transcript })
        : null,
    })),
    ...capsulePlays.map((play) => ({
      id: `capsule-${play.id}`,
      at: play.createdAt,
      kind: "capsule" as const,
      title:
        play.pageNumber === WELCOME_PAGE
          ? t("watchedWelcome", { name: readerName(play.view) })
          : t("watchedCapsule", {
              name: readerName(play.view),
              page: play.pageNumber,
            }),
    })),
    ...followups
      .filter((f) => f.sentAt && (f.status === "SENT" || f.status === "DELIVERED"))
      .map((f) => ({
        id: `followup-${f.id}`,
        at: f.sentAt!,
        kind: "followup" as const,
        title: t("followupSent", {
          trigger: tl(`followupTrigger.${f.trigger}`).toLowerCase(),
        }),
        detail: [
          t("followupDetail", {
            channel: tl(`channel.${f.channel}`),
            recipient: f.prospect.name ?? f.prospect.email,
          }),
          f.bouncedAt
            ? t("followupBounced")
            : f.repliedAt
              ? t("followupReplied")
              : f.clickedAt
                ? t("followupClicked")
                : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    ...sellerActivities.map((activity) => ({
      id: `seller-${activity.id}`,
      at: activity.occurredAt,
      kind: activity.source === "MANUAL" ? ("seller" as const) : ("reply" as const),
      // A reply Clozer caught: the prospect's own words, not the seller's note
      title:
        activity.source === "MANUAL"
          ? t("sellerNoted", { activity: tl(`sellerActivity.${activity.type}`) })
          : t(activity.source === "INBOUND" ? "replyCaught" : "replySeen", { from: activity.fromEmail ?? "" }),
      detail: activity.source === "MANUAL" ? activity.note : activity.note && t("quoted", { text: activity.note }),
    })),
    ...forwards.map((forward) => ({
      id: `forward-${forward.id}`,
      at: forward.createdAt,
      kind: "forward" as const,
      title: t("forwarded", {
        from: forward.fromProspect ? readerName({ prospect: forward.fromProspect, email: null }) : t("aReader"),
        to: readerName({ prospect: forward.toProspect, email: null }),
      }),
      detail: [forward.message && t("quoted", { text: forward.message }), !forward.sentAt && forward.error && t("notDelivered")]
        .filter(Boolean)
        .join(" · ") || null,
    })),
    ...alerts.map((alert) => {
      const payload = alert.payload as {
        liveViewers?: number;
        inactiveDays?: number;
        reason?: string;
        prospectName?: string | null;
        prospectEmail?: string | null;
        deadState?: "archived" | "expired";
      };
      if (alert.type === "DEAD_LINK_OPENED") {
        return {
          id: `alert-${alert.id}`,
          at: alert.createdAt,
          kind: "relink" as const,
          title: t(payload.deadState === "expired" ? "deadOpenExpired" : "deadOpenArchived", {
            name: payload.prospectName ?? payload.prospectEmail ?? t("theProspect"),
          }),
          detail: null,
        };
      }
      return {
        id: `alert-${alert.id}`,
        at: alert.createdAt,
        kind: "alert" as const,
        title: t("alert", {
          type: tl(`alertType.${alert.type}`).toLowerCase(),
        }),
        detail: payload.reason
          ? payload.reason
          : payload.liveViewers
            ? t("liveViewers", { count: payload.liveViewers })
            : payload.inactiveDays
              ? t("inactive", { days: payload.inactiveDays })
              : null,
      };
    }),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 40);

  const pagesByProspect = new Map<string, { pageNumber: number; totalDurationMs: number }[]>();
  for (const row of prospectPages) {
    const prospectId = row.view.prospectId!;
    const pages = pagesByProspect.get(prospectId) ?? [];
    const page = pages.find((p) => p.pageNumber === row.pageNumber);
    if (page) page.totalDurationMs += row.totalDurationMs;
    else pages.push({ pageNumber: row.pageNumber, totalDurationMs: row.totalDurationMs });
    pagesByProspect.set(prospectId, pages);
  }
  const forwardTree = buildForwardTree({
    prospects: link.prospects,
    forwards,
    persons: readerMap.persons,
    pagesByProspect,
    actionsByProspect: actionsByProspect([
      ...actions.map((a) => ({ prospectId: a.prospectId, action: FORWARD_ACTION[a.type], at: a.createdAt })),
      ...voiceRows.map((v) => ({ prospectId: v.prospectId, action: "voice" as const, at: v.createdAt })),
    ]),
  });

  const followupItems: FollowupItem[] = followups.map((f) =>
    toFollowupItem(f, title),
  );

  const signature = actions.find((action) => action.type === "VALIDATE_SIGN");
  const sharedReaders: SharedReader[] = link.shared
    ? await loadSharedReaders(
        link.id,
        link.document.id,
        link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec,
        now,
        { t, tl, locale },
      )
    : [];
  // What the title does not already say
  const contactLine = [
    mainProspect?.company ? mainProspect.name : null,
    mainProspect?.email,
  ]
    .filter((part): part is string => !!part && part !== title)
    .join(", ");

  return {
    link,
    now,
    canEdit,
    seller,
    score: score ? { tier: score.tier, score: score.score, reasons } : null,
    rawReasons: score?.reasons ?? null,
    settings,
    url,
    title,
    mainProspect,
    contactLine,
    sharing,
    dead,
    canReactivate,
    canDraftOnReactivate,
    revival,
    purgeAt,
    reading,
    sellerPrefs,
    settingsPanel,
    analytics,
    opened,
    readingNow,
    live,
    insight,
    nextAction,
    cta,
    recipientName,
    aiAvailable,
    draftWaiting,
    readerMap,
    chartData,
    showsDetail,
    isVideo,
    plates,
    transcript,
    voiceComments,
    welcome,
    linkCapsules,
    timeline,
    followupItems,
    signature,
    sharedReaders,
    forwardTree,
  };
}

export type Deal = NonNullable<Awaited<ReturnType<typeof loadDeal>>>;

/**
 * Readers of a shared link, each one's own link and where it stands: the ones
 * who stayed past the threshold first (to call), then the latest active.
 */
async function loadSharedReaders(
  linkId: string,
  documentId: string,
  thresholdSec: number,
  now: Date,
  { t, tl, locale }: { t: LoadDealT; tl: LabelsT; locale: UiLocale },
): Promise<SharedReader[]> {
  const links = await prisma.link.findMany({
    where: { parentLinkId: linkId, archivedAt: null },
    orderBy: [
      { lastActivityAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 200,
    select: {
      id: true,
      dealStatus: true,
      lastActivityAt: true,
      createdAt: true,
      engagementScore: { select: { tier: true } },
      prospects: {
        select: { email: true, name: true, company: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const reading = await readingByLink(
    links.map((reader) => reader.id),
    documentId,
  );
  const ranked = rankSharedReaders(
    links.map((reader) => ({
      ...reader,
      linkId: reader.id,
      readingMs: reading.get(reader.id)?.readingMs ?? 0,
      pricingMs: reading.get(reader.id)?.pricingMs ?? 0,
      lastActivityAt: reader.lastActivityAt ?? reader.createdAt,
    })),
    thresholdSec,
  );
  return ranked.map((reader) => {
    const prospect = reader.prospects[0];
    return {
      linkId: reader.id,
      hot: reader.hot,
      time:
        reader.pricingMs >= thresholdSec * 1000
          ? t("pricingTime", { time: formatDuration(reader.pricingMs) })
          : reader.readingMs > 0
            ? t("readingTime", { time: formatDuration(reader.readingMs) })
            : null,
      label: prospect?.name ?? prospect?.email ?? t("readerFallback"),
      detail: [
        prospect?.name ? prospect.email : null,
        prospect?.company,
        t("readAgo", {
          when: formatRelative(reader.lastActivityAt, locale, now),
        }),
      ]
        .filter(Boolean)
        .join(" · "),
      state:
        reader.dealStatus !== "OPEN"
          ? tl(`dealStatus.${reader.dealStatus}`)
          : reader.engagementScore
            ? tl(`tier.${reader.engagementScore.tier}`)
            : t("open"),
    };
  });
}

/** How far into a video pitch: "jusqu'au bout", or the share of it watched. */
function reachedDetail(t: LoadDealT, maxSegment: number) {
  if (maxSegment >= VIDEO_SEGMENTS) return t("watchedToEnd");
  return t("watchedPercent", {
    percent: Math.round((maxSegment * 100) / VIDEO_SEGMENTS),
  });
}

/** How far into a web page: the share of its video watched, or of its article read in Clozer. */
function depthDetail(t: LoadDealT, depth: number, video: boolean) {
  const percent = Math.round(depth * 100);
  if (video) return t("videoWatched", { percent });
  return percent > 0 ? t("articleRead", { percent }) : null;
}

/** What the reader did around the content, for a line of the timeline. */
function signalDetails(
  t: LoadDealT,
  signals: { type: ViewSignalType; valueMs: number | null; detail: string | null }[],
  locale: string,
) {
  const details: string[] = [];
  if (signals.some((s) => s.type === "EXTERNAL_OPEN")) {
    const awayMs = signals.reduce(
      (sum, s) => sum + (s.type === "EXTERNAL_RETURN" ? (s.valueMs ?? 0) : 0),
      0,
    );
    details.push(
      awayMs > 0
        ? t("siteOpenFor", { time: formatDuration(awayMs) })
        : t("siteOpened"),
    );
  }
  if (signals.some((s) => s.type === "DOWNLOAD"))
    details.push(t("pdfDownloaded"));
  const copiedPages = [...new Set(signals.filter((s) => s.type === "COPY_TEXT" && s.detail).map((s) => s.detail!))];
  if (copiedPages.length > 0) details.push(t("textCopied", { pages: copiedPages.join(", ") }));
  if (signals.some((s) => s.type === "PRINT")) details.push(t("printed"));
  if (signals.some((s) => s.type === "EXIT_PROMPT_OPENED"))
    details.push(t("exitAssistant"));
  for (const s of signals) {
    if (s.type === "TRANSLATED" && s.detail)
      details.push(t("readTranslated", { language: languageName(s.detail, locale) }));
  }
  return details;
}
