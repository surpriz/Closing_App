import type { TimelineItem } from "@/components/dashboard/activity-timeline";
import type { TranscriptConversation } from "@/components/dashboard/chat-transcript";
import {
  toFollowupItem,
  type FollowupItem,
} from "@/components/dashboard/followup-item";
import {
  ALERT_TYPE_LABELS,
  CHANNEL_LABELS,
  DEAL_STATUS_LABELS,
  FOLLOWUP_TRIGGER_LABELS,
  INSIGHT_ACTION_LABELS,
  SELLER_ACTIVITY_LABELS,
  TIER_LABELS,
  TIMING_LABELS,
} from "@/components/dashboard/labels";
import type { LinkCapsuleRow } from "@/components/dashboard/link-capsules";
import type { PageTimeDatum } from "@/components/dashboard/page-time-chart";
import type { SharedReader } from "@/components/dashboard/shared-readers";
import type { VoiceCommentItem } from "@/components/dashboard/voice-comments";
import type { ViewSignalType } from "@/generated/prisma/enums";
import { getAppOrigin } from "@/lib/app-origin";
import { sellerBookingUrl } from "@/lib/closing/booking/link-booking";
import { getLatestInsight } from "@/lib/closing/brain/latest";
import {
  capsulesVisibleOnLink,
  resolveCapsules,
  WELCOME_PAGE,
} from "@/lib/closing/capsules/resolve";
import { catchUpInBackground } from "@/lib/closing/catch-up";
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
import {
  reachedLabel,
  VIDEO_SEGMENTS,
} from "@/lib/closing/documents/video-segments";
import { hasReason } from "@/lib/closing/engagement/reasons";
import { freshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { getLinkLiveState } from "@/lib/closing/live";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { rankSharedReaders } from "@/lib/closing/shared/hot-readers";
import { readingByLink } from "@/lib/closing/shared/reading-time";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import type { EngagementReason } from "@/lib/closing/types";
import { prisma } from "@/lib/db";
import { formatDate, formatDuration, formatRelative } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import type { requireWorkspace } from "@/lib/session";

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;

/**
 * Everything the deal page shows about one link, read and shaped on the
 * server. Null when the link is not in this workspace or was archived.
 */
export async function loadDeal(
  id: string,
  workspace: Workspace,
  justCreated: boolean,
) {
  const { organization } = workspace;

  const link = await prisma.link.findFirst({
    where: { id, organizationId: organization.id, archivedAt: null },
    include: {
      document: {
        select: {
          id: true,
          name: true,
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
    getReaderMap(link.id),
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
  ]);
  const insightRecipient = insight?.recommendedAction.prospectId
    ? link.prospects.find((p) => p.id === insight.recommendedAction.prospectId)
    : null;

  const mainProspect = link.prospects[0];
  const title = dealLabel(link);
  const url = `${origin}/v/${link.slug}`;
  const now = new Date();

  // Just dropped, or not sent yet: the share screen leads the page
  const sharing = canEdit && (justCreated || !!link.draftAt);
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
        sellerActivities.find((a) =>
          (CONTACT_ACTIVITY_TYPES as readonly string[]).includes(a.type),
        )?.occurredAt ?? null,
      snoozedUntil: link.snoozedUntil,
      meetingBookedAt: link.meetingBookedAt,
      meetingAt: link.meetingAt,
      quoteRequestedAt: link.quoteRequestedAt,
    }),
    insightCurrent && insight
      ? {
          type: insight.recommendedAction.type,
          timing: insight.recommendedAction.timing,
          priority: insight.priority,
        }
      : null,
    { action: INSIGHT_ACTION_LABELS, timing: TIMING_LABELS },
  );
  const aiAvailable = getLanguageModel("analyze") !== null;
  const draftWaiting = followups.some(
    (f) =>
      f.trigger === "AI_DECISION" &&
      (f.status === "DRAFT" || f.status === "PENDING"),
  );
  // A link that left the open states (won, lost) has nothing left to push
  const cta = openStatus
    ? dealCta(nextAction, {
        email: mainProspect?.email ?? null,
        phone: mainProspect?.phoneE164 ?? null,
        draftWaiting,
        canPrepareFollowup: aiAvailable && !!insight?.byAi,
        aiActionType:
          insightCurrent && insight ? insight.recommendedAction.type : null,
      })
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
        "Lecteur anonyme",
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
    view.prospect?.name ?? view.prospect?.email ?? view.email ?? "Le prospect";
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
  const readerLabels = labelReaders(analytics.recentViews);
  const isEmbeddedVideo =
    link.document.kind === "URL" &&
    videoProvider(link.document.embedUrl) !== null;
  const timeline: TimelineItem[] = [
    {
      id: `created-${link.id}`,
      at: link.createdAt,
      kind: "created" as const,
      title: "Lien créé",
    },
    ...analytics.recentViews.map((view) => ({
      id: `view-${view.id}`,
      at: view.startedAt,
      kind: "view" as const,
      title: `Lecture par ${readerLabels.get(view.id)?.name ?? "un lecteur"}`,
      detail: [
        formatDuration(view.totalDurationMs),
        link.document.kind === "URL"
          ? null
          : link.document.kind === "VIDEO"
            ? `regardé ${reachedLabel(view.maxPageReached)}`
            : `jusqu'à la page ${view.maxPageReached}`,
        link.document.kind === "URL"
          ? depthDetail(view.pageViews[0]?.maxScrollDepth ?? 0, isEmbeddedVideo)
          : null,
        ...signalDetails(view.signals),
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
      title: `${action.signerName ?? action.prospect?.name ?? action.prospect?.email ?? "Le prospect"} ${
        action.type === "VALIDATE_SIGN"
          ? action.signerName
            ? "a signé « Bon pour accord »"
            : "a validé la proposition"
          : action.type === "REQUEST_EXTENSION"
            ? "demande une prolongation"
            : action.type === "MEETING_BOOKED"
              ? "a pris rendez-vous dans votre agenda"
              : action.type === "MEETING_CLICK"
                ? "a ouvert votre agenda"
                : action.type === "REQUEST_QUOTE"
                  ? "demande un devis"
                  : "demande un ajustement"
      }`,
      detail: action.message
        ? `« ${action.message} »`
        : action.id === latestBooking?.id && link.meetingAt
          ? `Rendez-vous le ${formatDate(link.meetingAt)}`
          : action.signerName && action.prospect?.email
            ? // The gate takes the reader's word: nothing proves they own that mailbox
              `Nom saisi par le signataire, lien ouvert avec l'email ${action.prospect.email} (non vérifié)`
            : null,
    })),
    ...chatRows
      .filter((row) => row.escalated)
      .map((row) => ({
        id: `question-${row.id}`,
        at: row.createdAt,
        kind: "question" as const,
        title: `${readerName(row.view)} a une question pour vous`,
        detail: `« ${row.content} »`,
      })),
    ...voiceComments.map((comment) => ({
      id: `voice-${comment.id}`,
      at: comment.createdAt,
      kind: "voice" as const,
      title: `${comment.reader} a laissé un vocal page ${comment.pageNumber}`,
      detail: comment.transcript ? `« ${comment.transcript} »` : null,
    })),
    ...capsulePlays.map((play) => ({
      id: `capsule-${play.id}`,
      at: play.createdAt,
      kind: "capsule" as const,
      title:
        play.pageNumber === WELCOME_PAGE
          ? `${readerName(play.view)} a regardé votre mot d'accueil`
          : `${readerName(play.view)} a regardé votre capsule page ${play.pageNumber}`,
    })),
    ...followups
      .filter((f) => f.sentAt && f.status === "SENT")
      .map((f) => ({
        id: `followup-${f.id}`,
        at: f.sentAt!,
        kind: "followup" as const,
        title: `Relance envoyée (${FOLLOWUP_TRIGGER_LABELS[f.trigger].toLowerCase()})`,
        detail: `${CHANNEL_LABELS[f.channel]} à ${f.prospect.name ?? f.prospect.email}`,
      })),
    ...sellerActivities.map((activity) => ({
      id: `seller-${activity.id}`,
      at: activity.occurredAt,
      kind: "seller" as const,
      title: `${SELLER_ACTIVITY_LABELS[activity.type]} (noté par vous)`,
      detail: activity.note,
    })),
    ...alerts.map((alert) => {
      const payload = alert.payload as {
        liveViewers?: number;
        inactiveDays?: number;
        reason?: string;
      };
      return {
        id: `alert-${alert.id}`,
        at: alert.createdAt,
        kind: "alert" as const,
        title: `Alerte : ${ALERT_TYPE_LABELS[alert.type].toLowerCase()}`,
        detail: payload.reason
          ? payload.reason
          : payload.liveViewers
            ? `${payload.liveViewers} lecteurs en même temps`
            : payload.inactiveDays
              ? `après ${payload.inactiveDays} jours sans lecture`
              : null,
      };
    }),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 40);

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
          ? `${formatDuration(reader.pricingMs)} sur le tarif`
          : reader.readingMs > 0
            ? `${formatDuration(reader.readingMs)} de lecture`
            : null,
      label: prospect?.name ?? prospect?.email ?? "Lecteur",
      detail: [
        prospect?.name ? prospect.email : null,
        prospect?.company,
        `lu ${formatRelative(reader.lastActivityAt, now)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      state:
        reader.dealStatus !== "OPEN"
          ? DEAL_STATUS_LABELS[reader.dealStatus]
          : reader.engagementScore
            ? TIER_LABELS[reader.engagementScore.tier]
            : "Ouvert",
    };
  });
}

/** How far into a web page: the share of its video watched, or of its article read in Clozer. */
function depthDetail(depth: number, video: boolean) {
  const percent = Math.round(depth * 100);
  if (video) return `${percent} % de la vidéo vue`;
  return percent > 0 ? `article lu à ${percent} %` : null;
}

/** What the reader did around the content, for a line of the timeline. */
function signalDetails(
  signals: { type: ViewSignalType; valueMs: number | null }[],
) {
  const details: string[] = [];
  if (signals.some((s) => s.type === "EXTERNAL_OPEN")) {
    const awayMs = signals.reduce(
      (sum, s) => sum + (s.type === "EXTERNAL_RETURN" ? (s.valueMs ?? 0) : 0),
      0,
    );
    details.push(
      awayMs > 0
        ? `site ouvert, ≈ ${formatDuration(awayMs)} dessus`
        : "site ouvert dans un onglet",
    );
  }
  if (signals.some((s) => s.type === "DOWNLOAD"))
    details.push("PDF téléchargé");
  if (signals.some((s) => s.type === "EXIT_PROMPT_OPENED"))
    details.push("a ouvert l'assistant en partant");
  return details;
}
