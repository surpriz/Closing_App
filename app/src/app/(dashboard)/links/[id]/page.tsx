import { ArrowLeft, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import {
  ActivityTimeline,
  type TimelineItem,
} from "@/components/dashboard/activity-timeline";
import { ArchiveLinkButton } from "@/components/dashboard/archive-link-button";
import {
  ChatTranscript,
  type TranscriptConversation,
} from "@/components/dashboard/chat-transcript";
import { CopyButton } from "@/components/dashboard/copy-button";
import { DealContextForm } from "@/components/dashboard/deal-context-form";
import { DealContextSummaryDetails } from "@/components/dashboard/deal-context-details";
import { dealContextSummary } from "@/components/dashboard/deal-context-summary";
import { DealVerdict } from "@/components/dashboard/deal-verdict";
import { DealStatusSelect } from "@/components/dashboard/deal-status-select";
import {
  toFollowupItem,
  type FollowupItem,
} from "@/components/dashboard/followup-item";
import { FollowupsPanel } from "@/components/dashboard/followups-panel";
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
import {
  LinkCapsules,
  type LinkCapsuleRow,
} from "@/components/dashboard/link-capsules";
import { LinkSettingsDialog } from "@/components/dashboard/link-settings-form";
import { ShareReady } from "@/components/dashboard/share-ready";
import { SmartLinkTemplate } from "@/components/dashboard/smart-link-template";
import {
  SharedReaders,
  type SharedReader,
} from "@/components/dashboard/shared-readers";
import { WelcomeMessage } from "@/components/dashboard/welcome-message";
import { LinkTestTools } from "@/components/dashboard/link-test-tools";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { MarkWonButton } from "@/components/dashboard/mark-won-button";
import { SectionTitle, Surface } from "@/components/dashboard/page-header";
import {
  PageTimeChart,
  type PageTimeDatum,
} from "@/components/dashboard/page-time-chart";
import { ProspectPanel } from "@/components/dashboard/prospect-panel";
import {
  SellerActivityForm,
  SnoozeControl,
} from "@/components/dashboard/seller-activity-form";
import {
  VoiceComments,
  type VoiceCommentItem,
} from "@/components/dashboard/voice-comments";
import { ShareMailToolTip } from "@/components/onboarding/share-mail-tool-tip";
import { getAppOrigin } from "@/lib/app-origin";
import { capsuleUploadPrefix } from "@/lib/blob";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import type { ViewSignalType } from "@/generated/prisma/enums";
import { getLinkAnalytics } from "@/lib/closing/analytics";
import { dealLabel, linkLabelSelect } from "@/lib/closing/dashboard/labels";
import { videoProvider } from "@/lib/closing/documents/web-link";
import {
  DOC_TYPE_LABELS,
  type DocType,
} from "@/lib/closing/documents/doc-types";
import { linkTitle } from "@/lib/closing/documents/link-title";
import { reachedLabel } from "@/lib/closing/documents/video-segments";
import { showsCountdown } from "@/lib/closing/expiry";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { firstNameOf, guessMailClient } from "@/lib/closing/share/compose";
import { settingsSummary } from "@/lib/closing/share/summary";
import { sellerBookingUrl } from "@/lib/closing/booking/link-booking";
import { getLatestInsight } from "@/lib/closing/brain/latest";
import { getReaderMap } from "@/lib/closing/committee/queries";
import { ACTION_KIND } from "@/lib/closing/dashboard/feed";
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
import { showsReadingDetail } from "@/lib/closing/dashboard/reading-detail";
import { labelReaders } from "@/lib/closing/dashboard/readers";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import {
  capsulesVisibleOnLink,
  resolveCapsules,
  WELCOME_PAGE,
} from "@/lib/closing/capsules/resolve";
import { hasReason } from "@/lib/closing/engagement/reasons";
import { freshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { getLinkLiveState } from "@/lib/closing/live";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { rankSharedReaders } from "@/lib/closing/shared/hot-readers";
import { readingByLink } from "@/lib/closing/shared/reading-time";
import type { EngagementReason } from "@/lib/closing/types";
import { prisma } from "@/lib/db";
import { formatDate, formatDuration, formatRelative } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";
import { testToolsEnabled } from "@/lib/test-tools";

export async function generateMetadata({
  params,
}: PageProps<"/links/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { organization } = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id, organizationId: organization.id },
    select: linkLabelSelect,
  });
  return { title: link ? dealLabel(link) : "Prospect" };
}

export default async function LinkDetailPage({
  params,
  searchParams,
}: PageProps<"/links/[id]">) {
  const { id } = await params;
  const justCreated = (await searchParams).new === "1";
  const workspace = await requireWorkspace();
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
  if (!link) notFound();

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

  // Just dropped, or not sent yet: the share screen leads the page
  const sharing = canEdit && (justCreated || !!link.draftAt);
  // The AI has not said what the document is yet: the settings may still follow it (a few seconds)
  const reading =
    link.document.status === "PROCESSING" ||
    (link.autoSettings &&
      !link.document.aiProcessedAt &&
      new Date().getTime() - link.createdAt.getTime() < 2 * 60_000);
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
      now: new Date(),
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
  const showsDetail = showsReadingDetail({
    kind: link.document.kind,
    durationMs: link.document.durationMs,
    viewCount: analytics.viewCount,
    pagesWithTime: chartData.filter((page) => page.totalSeconds > 0).length,
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
  const isVideo = link.document.kind === "VIDEO";
  // A video pitch is already the seller speaking: no welcome bubble on top
  const welcome =
    canEdit && !isVideo ? (
      <WelcomeMessage
        documentId={link.document.id}
        // A shared link speaks to everyone: the document's message is the one
        linkId={link.shared ? null : link.id}
        documentWelcome={
          documentWelcomeRow ? capsuleSummary(documentWelcomeRow) : null
        }
        linkWelcome={linkWelcomeRow ? capsuleSummary(linkWelcomeRow) : null}
        uploadPrefix={capsuleUploadPrefix(organization.id)}
      />
    ) : null;
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

  const now = new Date();
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

  return (
    <div className="space-y-10">
      {sharing && (
        <div className="space-y-3">
          <ShareReady
            // Remount when the server state moves: sent, contact added, settings tuned by the AI
            key={[
              !!link.draftAt,
              link.prospects.length,
              link.expiresAt?.getTime(),
              link.ctaEnabled,
            ].join("|")}
            linkId={link.id}
            url={url}
            title={linkTitle({
              ...link.document,
              company: mainProspect?.company,
            })}
            sent={!link.draftAt}
            recipient={
              mainProspect
                ? {
                    email: mainProspect.email,
                    firstName: firstNameOf(mainProspect.name),
                  }
                : null
            }
            mailClient={
              sellerPrefs?.mailClient ?? guessMailClient(workspace.user.email)
            }
            signature={settings.senderSignature}
            processing={reading}
            summary={settingsSummary(link, now)}
            shared={link.shared}
            welcome={welcome}
            notice={
              link.autoSettings &&
              link.expiresAt &&
              showsCountdown(link.document.docType)
                ? `Reconnu comme « ${DOC_TYPE_LABELS[link.document.docType as DocType]} » : le prospect a jusqu'au ${formatDate(link.expiresAt)} et voit le décompte.`
                : null
            }
            settings={settingsPanel}
          />
          {sellerPrefs && (
            <ShareMailToolTip
              user={workspace.user}
              organizationId={organization.id}
              prefs={sellerPrefs}
            />
          )}
        </div>
      )}
      {sharing && reading && <AutoRefresh intervalMs={3000} />}
      <div className="space-y-4">
        <Link
          href={`/documents/${link.document.id}`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-4" aria-hidden /> {link.document.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-title [font-stretch:92%]">{title}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted-foreground">
              {contactLine && <span>{contactLine}</span>}
              {link.parentLink && (
                <Link
                  href={`/links/${link.parentLink.id}`}
                  className="hover:text-foreground hover:underline"
                >
                  via le lien partagé
                  {link.parentLink.name ? ` « ${link.parentLink.name} »` : ""}
                </Link>
              )}
              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted py-0.5 pr-0.5 pl-2 font-mono text-small ring-1 ring-border">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:text-foreground hover:underline"
                >
                  {url.replace(/^https?:\/\//, "")}
                </a>
                <CopyButton value={url} />
              </span>
              {link.expiresAt && canEdit && (
                <a
                  href="#expiration"
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-small ring-1 ring-border hover:text-foreground hover:underline ${
                    link.expiresAt <= now ? "text-destructive" : ""
                  }`}
                >
                  <Hourglass className="size-3.5" aria-hidden />
                  {link.expiresAt <= now
                    ? `Expiré ${formatRelative(link.expiresAt, now)}`
                    : `Expire ${formatRelative(link.expiresAt, now)}`}
                </a>
              )}
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              {!link.shared && (
                <DealStatusSelect linkId={link.id} status={link.dealStatus} />
              )}
              <LinkSettingsDialog name={link.name ?? ""} {...settingsPanel} />
              <ArchiveLinkButton linkId={link.id} />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {DEAL_STATUS_LABELS[link.dealStatus]}
            </span>
          )}
        </div>
        {!canEdit && (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Deal de {seller?.name || seller?.email || "un autre commercial"}.
            Vous pouvez le consulter, seuls son commercial et les admins peuvent
            le modifier.
          </p>
        )}
        {canEdit && link.dealStatus === "VALIDATED" && signature && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm">
            <span>
              <span className="font-medium">
                {signature.signerName ??
                  signature.prospect?.name ??
                  signature.prospect?.email ??
                  "Le prospect"}
              </span>{" "}
              a validé {formatRelative(signature.createdAt, now)}. Confirmez la
              vente pour arrêter les relances.
            </span>
            <MarkWonButton linkId={link.id} />
          </div>
        )}
        {link.expiresAt && link.expiresAt <= now && (
          <a
            href="#expiration"
            className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive hover:underline"
          >
            <Hourglass className="size-4 shrink-0" aria-hidden />
            Ce lien a expiré : le prospect ne peut plus l&apos;ouvrir.
            Prolongez-le pour le réactiver.
          </a>
        )}
      </div>

      {/* Disables every form and button below for a read-only visit */}
      <fieldset disabled={!canEdit} className="min-w-0 space-y-10">
        <div className="space-y-4">
          <LiveActivity
            key={live.stamp}
            linkId={link.id}
            initial={live}
            pageCount={
              link.document.kind === "URL" ? null : link.document.pages.length
            }
            video={link.document.kind === "VIDEO"}
          />

          <DealVerdict
            linkId={link.id}
            insight={insight}
            score={
              score ? { tier: score.tier, score: score.score, reasons } : null
            }
            opened={opened}
            readingNow={readingNow}
            lastActivityAt={analytics.lastActivityAt}
            viewCount={analytics.viewCount}
            totalDurationMs={analytics.totalDurationMs}
            action={nextAction}
            recipientName={(() => {
              const name = insightRecipient
                ? (insightRecipient.name ?? insightRecipient.email)
                : null;
              return name && name !== title ? name : null;
            })()}
            aiAvailable={getLanguageModel("analyze") !== null}
            readSince={
              !!insight &&
              !!link.lastActivityAt &&
              link.lastActivityAt > insight.createdAt
            }
            draftWaiting={followups.some(
              (f) =>
                f.trigger === "AI_DECISION" &&
                (f.status === "DRAFT" || f.status === "PENDING"),
            )}
            now={now}
            scoreGuide={{
              hasPages: link.document.kind !== "URL",
              hasPricing: link.document.pages.some((page) =>
                page.tags.includes("PRICING"),
              ),
              pricingThresholdSec:
                link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec,
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-10">
            <section id="relances" className="scroll-mt-20">
              <SectionTitle>Relances</SectionTitle>
              <Surface className="p-4">
                <FollowupsPanel followups={followupItems} />
              </Surface>
            </section>

            {transcript.length > 0 && (
              <section id="questions" className="scroll-mt-20">
                <SectionTitle hint="posées à l'assistant du document">
                  Questions du prospect
                </SectionTitle>
                <Surface>
                  <ChatTranscript conversations={transcript} />
                </Surface>
              </section>
            )}

            {voiceComments.length > 0 && (
              <section id="vocaux" className="scroll-mt-20">
                <SectionTitle hint="laissés sur les pages du document">
                  Commentaires vocaux
                </SectionTitle>
                <Surface>
                  <VoiceComments comments={voiceComments} />
                </Surface>
              </section>
            )}

            {!sharing && welcome && (
              <section id="mot-accueil" className="scroll-mt-20">
                <SectionTitle hint="le prospect le voit dès l'ouverture">
                  Mot d&apos;accueil
                </SectionTitle>
                <Surface className="px-4 py-3">{welcome}</Surface>
              </section>
            )}

            {linkCapsules.length > 0 && (
              <section id="capsules" className="scroll-mt-20">
                <SectionTitle hint="enregistrées avant le mot d'accueil">
                  Capsules par page
                </SectionTitle>
                <Surface className="px-4 py-3">
                  <LinkCapsules
                    documentId={link.document.id}
                    linkId={link.id}
                    pages={link.document.pages}
                    capsules={linkCapsules}
                    canEdit={canEdit}
                    uploadPrefix={capsuleUploadPrefix(organization.id)}
                  />
                </Surface>
              </section>
            )}

            {showsDetail && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-baseline gap-2 text-body font-semibold outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                  <span className="text-muted-foreground transition-transform group-open:rotate-90">
                    ›
                  </span>
                  Lecture détaillée
                  <span className="font-normal text-muted-foreground">
                    {isVideo
                      ? "temps passé sur chaque passage de la vidéo"
                      : "temps passé par page"}
                  </span>
                </summary>
                <Surface className="mt-3 p-4">
                  <p className="mb-2 flex items-center justify-end gap-1.5 text-sm text-muted-foreground">
                    <span className="size-2.5 rounded-sm bg-heat-warm" />{" "}
                    {isVideo ? "passage sur les tarifs" : "page de tarifs"}
                  </p>
                  <PageTimeChart data={chartData} video={isVideo} />
                </Surface>
              </details>
            )}

            <section>
              <SectionTitle>Activité</SectionTitle>
              <div className="pl-3">
                <ActivityTimeline items={timeline} />
              </div>
            </section>

            {testToolsEnabled() && <LinkTestTools linkId={link.id} />}
          </div>

          <aside className="space-y-10">
            {link.shared ? (
              <>
                <section id="lecteurs" className="scroll-mt-20">
                  <SectionTitle hint="chacun a son lien et son suivi">
                    Lecteurs
                  </SectionTitle>
                  <Surface>
                    <SharedReaders readers={sharedReaders} />
                  </Surface>
                </section>
                {canEdit && (
                  <section>
                    <SectionTitle hint="Lemlist, Instantly, Apollo…">
                      Smart Link pour cold email
                    </SectionTitle>
                    <Surface>
                      <SmartLinkTemplate url={url} />
                    </Surface>
                  </section>
                )}
              </>
            ) : (
              <section>
                <SectionTitle hint="reçoit les relances, et qui a lu">
                  Prospect
                </SectionTitle>
                <ProspectPanel
                  linkId={link.id}
                  prospects={link.prospects}
                  map={readerMap}
                  now={now}
                />
              </section>
            )}

            <section>
              <DealContextSummaryDetails
                summary={dealContextSummary({
                  amountCents: link.dealAmountCents,
                  currency: link.dealCurrency,
                  decisionDeadline: link.decisionDeadline,
                  decisionMakerName: link.decisionMakerName,
                  decisionMakerRole: link.decisionMakerRole,
                })}
                paused={!!link.snoozedUntil && link.snoozedUntil > now}
              >
                <div className="divide-y divide-border">
                  <DealContextForm
                    linkId={link.id}
                    initial={{
                      // Not updatedAt: it moves on every tracking flush and the page refreshes itself
                      version: [
                        link.dealAmountCents,
                        link.dealCurrency,
                        link.decisionDeadline?.getTime(),
                        link.decisionMakerName,
                        link.decisionMakerRole,
                        link.sellerNotes,
                        !!link.referenceConsentAt,
                      ].join("|"),
                      dealAmount:
                        link.dealAmountCents !== null
                          ? String(link.dealAmountCents / 100)
                          : "",
                      dealCurrency: link.dealCurrency ?? "EUR",
                      decisionDeadline:
                        link.decisionDeadline?.toISOString().slice(0, 10) ?? "",
                      decisionMakerName: link.decisionMakerName ?? "",
                      decisionMakerRole: link.decisionMakerRole ?? "",
                      sellerNotes: link.sellerNotes ?? "",
                      referenceConsent: !!link.referenceConsentAt,
                    }}
                  />
                  <SnoozeControl
                    linkId={link.id}
                    snoozedUntil={
                      link.snoozedUntil && link.snoozedUntil > now
                        ? link.snoozedUntil.toISOString()
                        : null
                    }
                  />
                </div>
              </DealContextSummaryDetails>
            </section>

            <section>
              <SectionTitle hint="appels, réponses, rendez-vous">
                Noter un échange
              </SectionTitle>
              <Surface>
                <SellerActivityForm linkId={link.id} />
              </Surface>
            </section>
          </aside>
        </div>
      </fieldset>
    </div>
  );
}

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
