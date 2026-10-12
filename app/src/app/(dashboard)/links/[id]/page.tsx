import { ArrowLeft, ChevronRight, Hourglass, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { ActivityTimeline, type TimelineItem } from "@/components/dashboard/activity-timeline";
import { ArchiveLinkButton } from "@/components/dashboard/archive-link-button";
import { ChatTranscript, type TranscriptConversation } from "@/components/dashboard/chat-transcript";
import { CopyButton } from "@/components/dashboard/copy-button";
import { DealContextForm } from "@/components/dashboard/deal-context-form";
import { DealInsightPanel } from "@/components/dashboard/deal-insight-panel";
import { DealStatusSelect } from "@/components/dashboard/deal-status-select";
import { toFollowupItem, type FollowupItem } from "@/components/dashboard/followup-item";
import { FollowupsPanel } from "@/components/dashboard/followups-panel";
import { HEAT_BG } from "@/components/dashboard/heat";
import {
  ALERT_TYPE_LABELS,
  CHANNEL_LABELS,
  DEAL_STATUS_LABELS,
  FOLLOWUP_TRIGGER_LABELS,
  SCORE_REASON_LABELS,
  SELLER_ACTIVITY_LABELS,
  TIER_LABELS,
} from "@/components/dashboard/labels";
import { ExpiryControl } from "@/components/dashboard/expiry-control";
import { LinkCapsules, type LinkCapsuleRow } from "@/components/dashboard/link-capsules";
import { LinkSettingsDialog } from "@/components/dashboard/link-settings-form";
import { ShareReady } from "@/components/dashboard/share-ready";
import { SharedReaders, type SharedReader } from "@/components/dashboard/shared-readers";
import { WelcomeMessage } from "@/components/dashboard/welcome-message";
import { LinkTestTools } from "@/components/dashboard/link-test-tools";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { MarkWonButton } from "@/components/dashboard/mark-won-button";
import { SectionTitle, StatLine, Surface } from "@/components/dashboard/page-header";
import { PageTimeChart, type PageTimeDatum } from "@/components/dashboard/page-time-chart";
import { ProspectForm } from "@/components/dashboard/prospect-form";
import { ReadersMap } from "@/components/dashboard/readers-map";
import { SellerActivityForm, SnoozeControl } from "@/components/dashboard/seller-activity-form";
import { ScoreGuide, TemperatureGauge } from "@/components/dashboard/temperature";
import { VoiceComments, type VoiceCommentItem } from "@/components/dashboard/voice-comments";
import { ShareMailToolTip } from "@/components/onboarding/share-mail-tool-tip";
import { getAppOrigin } from "@/lib/app-origin";
import { capsuleUploadPrefix } from "@/lib/blob";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import type { ViewSignalType } from "@/generated/prisma/enums";
import { getLinkAnalytics } from "@/lib/closing/analytics";
import { videoProvider } from "@/lib/closing/documents/web-link";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/closing/documents/doc-types";
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
import { canEditDeal } from "@/lib/closing/dashboard/queries";
import { labelReaders } from "@/lib/closing/dashboard/readers";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { capsulesVisibleOnLink, resolveCapsules, WELCOME_PAGE } from "@/lib/closing/capsules/resolve";
import { freshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { getLinkLiveState } from "@/lib/closing/live";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import type { EngagementReason } from "@/lib/closing/types";
import { prisma } from "@/lib/db";
import { formatDate, formatDuration, formatRelative } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";
import { testToolsEnabled } from "@/lib/test-tools";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/links/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { organization } = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id, organizationId: organization.id },
    select: { name: true, slug: true, prospects: { select: { company: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  return { title: link?.prospects[0]?.company ?? link?.name ?? "Prospect" };
}

export default async function LinkDetailPage({ params, searchParams }: PageProps<"/links/[id]">) {
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
          pages: { select: { pageNumber: true, tags: true, summary: true }, orderBy: { pageNumber: "asc" } },
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
      ? await prisma.user.findUnique({ where: { id: link.createdById }, select: { name: true, email: true } })
      : null;

  const score = await freshEngagementScore(link.id, link.engagementScore);
  catchUpInBackground({ organizationId: organization.id, linkId: link.id, documentId: link.document.id });

  const [analytics, settings, origin, followups, alerts, actions, live, sellerActivities, insight, readerMap, chatRows, capsuleRows, capsulePlays, voiceRows] = await Promise.all([
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
      where: { linkId: link.id, type: { notIn: ["PROSPECT_VALIDATED", "CHANGE_REQUESTED", "QUOTE_REQUESTED", "MEETING_BOOKED", "PROSPECT_QUESTION", "LINK_EXTENSION_REQUESTED", "VOICE_COMMENT"] } },
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
    prisma.sellerActivity.findMany({ where: { linkId: link.id }, orderBy: { occurredAt: "desc" }, take: 20 }),
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
        view: { select: { visitorId: true, email: true, prospect: { select: { name: true, email: true } } } },
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
      select: { id: true, pageNumber: true, createdAt: true, view: { select: { email: true, prospect: { select: { name: true, email: true } } } } },
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
        view: { select: { email: true, prospect: { select: { name: true, email: true } } } },
      },
    }),
  ]);
  const insightRecipient = insight?.recommendedAction.prospectId
    ? link.prospects.find((p) => p.id === insight.recommendedAction.prospectId)
    : null;

  const mainProspect = link.prospects[0];
  const title = mainProspect?.company ?? link.name ?? mainProspect?.email ?? link.slug;
  const url = `${origin}/v/${link.slug}`;

  // Just dropped, or not sent yet: the share screen leads the page
  const sharing = canEdit && (justCreated || !!link.draftAt);
  // The AI has not said what the document is yet: the settings may still follow it (a few seconds)
  const reading =
    link.document.status === "PROCESSING" ||
    (link.autoSettings && !link.document.aiProcessedAt && new Date().getTime() - link.createdAt.getTime() < 2 * 60_000);
  const sellerPrefs = sharing ? await getSellerPrefs(workspace.user.id, organization.id) : null;
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
      ? actions.filter((a) => a.type === "REQUEST_EXTENSION" && a.createdAt >= link.expiresAt!).length
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
      avgSeconds: stat?.viewCount ? Math.round(total / stat.viewCount / 1000) : 0,
      isPricing: page.tags.includes("PRICING"),
      summary: page.summary,
    };
  });

  const reasons = Array.isArray(score?.reasons) ? (score.reasons as unknown as EngagementReason[]) : [];

  const conversations = new Map<string, TranscriptConversation>();
  for (const row of [...chatRows].reverse()) {
    const conversation = conversations.get(row.view.visitorId) ?? {
      visitorId: row.view.visitorId,
      reader: row.view.prospect?.name ?? row.view.prospect?.email ?? row.view.email ?? "Lecteur anonyme",
      messages: [],
    };
    conversation.messages.push(row);
    conversations.set(row.view.visitorId, conversation);
  }
  // Latest conversation first
  const transcript = [...conversations.values()].reverse();

  const readerName = (view: { email: string | null; prospect: { name: string | null; email: string } | null }) =>
    view.prospect?.name ?? view.prospect?.email ?? view.email ?? "Le prospect";
  const voiceComments: VoiceCommentItem[] = voiceRows.map((row) => ({ ...row, reader: readerName(row.view) }));
  const capsuleSummary = (row: (typeof capsuleRows)[number]) => ({
    id: row.id,
    kind: row.kind,
    hookText: row.hookText,
    durationMs: row.durationMs,
    plays: row._count.plays,
  });
  const welcomeRows = capsuleRows.filter((row) => row.pageNumber === WELCOME_PAGE);
  const documentWelcomeRow = welcomeRows.find((row) => row.linkId === null);
  const linkWelcomeRow = welcomeRows.find((row) => row.linkId === link.id);
  const isVideo = link.document.kind === "VIDEO";
  // A video pitch is already the seller speaking: no welcome bubble on top
  const welcome = canEdit && !isVideo ? (
    <WelcomeMessage
      documentId={link.document.id}
      // A shared link speaks to everyone: the document's message is the one
      linkId={link.shared ? null : link.id}
      documentWelcome={documentWelcomeRow ? capsuleSummary(documentWelcomeRow) : null}
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
  const latestBooking = actions.find((action) => action.type === "MEETING_BOOKED");
  const readerLabels = labelReaders(analytics.recentViews);
  const isEmbeddedVideo = link.document.kind === "URL" && videoProvider(link.document.embedUrl) !== null;
  const timeline: TimelineItem[] = [
    { id: `created-${link.id}`, at: link.createdAt, kind: "created" as const, title: "Lien créé" },
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
        isEmbeddedVideo ? `${Math.round((view.pageViews[0]?.maxScrollDepth ?? 0) * 100)} % de la vidéo vue` : null,
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
      const payload = alert.payload as { liveViewers?: number; inactiveDays?: number; reason?: string };
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

  const followupItems: FollowupItem[] = followups.map((f) => toFollowupItem(f, link.name ?? link.slug));

  const now = new Date();
  const signature = actions.find((action) => action.type === "VALIDATE_SIGN");
  const sharedReaders: SharedReader[] = link.shared ? await loadSharedReaders(link.id, now) : [];
  const contactLine = [mainProspect?.company ? mainProspect.name : null, mainProspect?.email]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-10">
      {sharing && (
        <div className="space-y-3">
          <ShareReady
            // Remount when the server state moves: sent, contact added, settings tuned by the AI
            key={[!!link.draftAt, link.prospects.length, link.expiresAt?.getTime(), link.ctaEnabled].join("|")}
            linkId={link.id}
            url={url}
            title={linkTitle({ ...link.document, company: mainProspect?.company })}
            sent={!link.draftAt}
            recipient={mainProspect ? { email: mainProspect.email, firstName: firstNameOf(mainProspect.name) } : null}
            mailClient={sellerPrefs?.mailClient ?? guessMailClient(workspace.user.email)}
            signature={settings.senderSignature}
            processing={reading}
            summary={settingsSummary(link, now)}
            shared={link.shared}
            welcome={welcome}
            notice={
              link.autoSettings && link.expiresAt && showsCountdown(link.document.docType)
                ? `Reconnu comme « ${DOC_TYPE_LABELS[link.document.docType as DocType]} » : le prospect a jusqu'au ${formatDate(link.expiresAt)} et voit le décompte.`
                : null
            }
            settings={settingsPanel}
          />
          {sellerPrefs && (
            <ShareMailToolTip user={workspace.user} organizationId={organization.id} prefs={sellerPrefs} />
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
                <Link href={`/links/${link.parentLink.id}`} className="hover:text-foreground hover:underline">
                  via le lien partagé{link.parentLink.name ? ` « ${link.parentLink.name} »` : ""}
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
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              {!link.shared && <DealStatusSelect linkId={link.id} status={link.dealStatus} />}
              <LinkSettingsDialog name={link.name ?? ""} {...settingsPanel} />
              <ArchiveLinkButton linkId={link.id} />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{DEAL_STATUS_LABELS[link.dealStatus]}</span>
          )}
        </div>
        {!canEdit && (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Deal de {seller?.name || seller?.email || "un autre commercial"}. Vous pouvez le consulter, seuls son
            commercial et les admins peuvent le modifier.
          </p>
        )}
        {canEdit && link.dealStatus === "VALIDATED" && signature && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm">
            <span>
              <span className="font-medium">
                {signature.signerName ?? signature.prospect?.name ?? signature.prospect?.email ?? "Le prospect"}
              </span>{" "}
              a validé {formatRelative(signature.createdAt, now)}. Confirmez la vente pour arrêter les relances.
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
            Ce lien a expiré : le prospect ne peut plus l&apos;ouvrir. Prolongez-le pour le réactiver.
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
            pageCount={link.document.kind === "URL" ? null : link.document.pages.length}
            video={link.document.kind === "VIDEO"}
          />

          <DealInsightPanel
            linkId={link.id}
            insight={insight}
            recipientName={insightRecipient ? (insightRecipient.name ?? insightRecipient.email) : null}
            aiAvailable={getLanguageModel("analyze") !== null}
            readSince={!!insight && !!link.lastActivityAt && link.lastActivityAt > insight.createdAt}
            draftWaiting={followups.some((f) => f.trigger === "AI_DECISION" && (f.status === "DRAFT" || f.status === "PENDING"))}
            now={now}
          />

          <Surface className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="relative space-y-3 border-b border-border p-5 md:border-r md:border-b-0">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 origin-bottom animate-heat-fill motion-reduce:animate-none",
                    score ? HEAT_BG[score.tier] : "bg-foreground/10",
                  )}
                />
                <p className="text-sm text-muted-foreground">Température mesurée</p>
                <p className="text-[2rem] leading-none font-medium tracking-[-0.03em] [font-stretch:88%]">
                  {score ? TIER_LABELS[score.tier] : "Pas encore lu"}
                </p>
                {score && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground tabular-nums">{score.score}</span> sur 100
                    </p>
                    <TemperatureGauge tier={score.tier} score={score.score} />
                  </>
                )}
                {insight?.scoreNuance && <p className="text-sm text-muted-foreground">{insight.scoreNuance}</p>}
              </div>
              <div className="p-5">
                <p className="mb-3 text-sm text-muted-foreground">Pourquoi</p>
                {reasons.length === 0 ? (
                  <p className="text-body">
                    Rien encore : la température monte dès que le prospect ouvre son lien et lit.
                  </p>
                ) : (
                  <ul className="grid gap-x-8 gap-y-2 text-body sm:grid-cols-2">
                    {reasons.map((reason) => (
                      <li key={reason.code} className="flex items-baseline justify-between gap-3">
                        <span>
                          {SCORE_REASON_LABELS[reason.code] ?? reason.code}
                          {reason.detail && <span className="text-muted-foreground"> ({reason.detail})</span>}
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">+{reason.weight}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {analytics.viewCount > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <StatLine
                      items={[
                        { value: analytics.viewCount, label: analytics.viewCount === 1 ? "lecture" : "lectures" },
                        { value: formatDuration(analytics.totalDurationMs), label: "de lecture" },
                        ...(live.readers.length > 0
                          ? [{ value: "en ce moment", label: "lu", labelFirst: true }]
                          : analytics.lastActivityAt
                            ? [{ value: formatRelative(analytics.lastActivityAt, now), label: "lu", labelFirst: true }]
                            : []),
                      ]}
                    />
                  </div>
                )}
                <ScoreGuide
                  hasPages={link.document.kind !== "URL"}
                  hasPricing={link.document.pages.some((page) => page.tags.includes("PRICING"))}
                  pricingThresholdSec={link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec}
                />
              </div>
            </div>
          </Surface>

        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-10">
            {link.document.kind !== "URL" && (
              <section>
                <SectionTitle
                  hint="pour ce prospect"
                  action={
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span className="size-2.5 rounded-sm bg-heat-warm" /> {isVideo ? "passage sur les tarifs" : "page de tarifs"}
                    </span>
                  }
                >
                  {isVideo ? "Temps passé sur chaque passage de la vidéo" : "Temps passé par page"}
                </SectionTitle>
                <Surface className="p-4">
                  <PageTimeChart data={chartData} video={isVideo} />
                </Surface>
              </section>
            )}

            <section id="relances" className="scroll-mt-20">
              <SectionTitle>Relances</SectionTitle>
              <Surface className="p-4">
                <FollowupsPanel
                  followups={followupItems}
                  emptyHint={
                    insight?.byAi
                      ? insight.recommendedAction.type === "send_followup"
                        ? `L'analyse conseille de relancer, mais ce n'est pas encore le moment (${insight.recommendedAction.why}). Vous pouvez aussi cliquer « Préparer une relance » plus haut.`
                        : `L'analyse conseille plutôt : ${insight.recommendedAction.why} Besoin d'écrire quand même ? « Préparer une relance » plus haut.`
                      : null
                  }
                />
              </Surface>
            </section>

            {transcript.length > 0 && (
              <section id="questions" className="scroll-mt-20">
                <SectionTitle hint="posées à l'assistant du document">Questions du prospect</SectionTitle>
                <Surface>
                  <ChatTranscript conversations={transcript} />
                </Surface>
              </section>
            )}

            {voiceComments.length > 0 && (
              <section id="vocaux" className="scroll-mt-20">
                <SectionTitle hint="laissés sur les pages du document">Commentaires vocaux</SectionTitle>
                <Surface>
                  <VoiceComments comments={voiceComments} />
                </Surface>
              </section>
            )}

            {!sharing && welcome && (
              <section id="mot-accueil" className="scroll-mt-20">
                <SectionTitle hint="le prospect le voit dès l'ouverture">Mot d&apos;accueil</SectionTitle>
                <Surface className="px-4 py-3">{welcome}</Surface>
              </section>
            )}

            {linkCapsules.length > 0 && (
              <section id="capsules" className="scroll-mt-20">
                <SectionTitle hint="enregistrées avant le mot d'accueil">Capsules par page</SectionTitle>
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

            {testToolsEnabled() && <LinkTestTools linkId={link.id} />}

            <section>
              <SectionTitle>Activité</SectionTitle>
              <div className="pl-3">
                <ActivityTimeline items={timeline} />
              </div>
            </section>
          </div>

          <aside className="space-y-10">
            <section id="expiration" className="scroll-mt-20">
              <SectionTitle hint="le lien se verrouille ensuite">Expiration</SectionTitle>
              <Surface>
                <ExpiryControl
                  linkId={link.id}
                  expiresAt={link.expiresAt?.toISOString() ?? null}
                  requests={
                    link.expiresAt
                      ? actions.filter((a) => a.type === "REQUEST_EXTENSION" && a.createdAt >= link.expiresAt!).length
                      : 0
                  }
                  canEdit={canEdit}
                />
              </Surface>
            </section>

            <section id="qui-lit" className="scroll-mt-20">
              <SectionTitle hint="qui a ouvert la proposition">Qui lit</SectionTitle>
              <ReadersMap linkId={link.id} map={readerMap} now={now} />
            </section>

            {link.shared ? (
              <section id="lecteurs" className="scroll-mt-20">
                <SectionTitle hint="chacun a son lien et son suivi">Lecteurs</SectionTitle>
                <Surface>
                  <SharedReaders readers={sharedReaders} />
                </Surface>
              </section>
            ) : (
            <section>
              <SectionTitle hint="reçoivent les relances">Contacts</SectionTitle>
            <Surface>
              <div className="divide-y divide-border">
                {link.prospects.map((prospect) => (
                  <details key={prospect.id} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 text-sm">
                        <span className="font-medium">{prospect.name ?? prospect.email}</span>
                        {prospect.unsubscribedAt && <span className="ml-2 text-destructive">désinscrit</span>}
                        <span className="block truncate text-muted-foreground">
                          {[
                            prospect.name ? prospect.email : null,
                            prospect.phoneE164,
                            prospect.whatsappOptInAt ? "WhatsApp accepté" : null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <ProspectForm
                      linkId={link.id}
                      prospect={{
                        id: prospect.id,
                        email: prospect.email,
                        name: prospect.name,
                        company: prospect.company,
                        phoneE164: prospect.phoneE164,
                        whatsappOptIn: !!prospect.whatsappOptInAt,
                      }}
                    />
                  </details>
                ))}
                <details className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                    <Plus className="size-4" /> Ajouter un contact
                  </summary>
                  <ProspectForm linkId={link.id} />
                </details>
              </div>
            </Surface>
            </section>
            )}

            <section>
              <SectionTitle hint="votre équipe le voit, pas le prospect">Le deal</SectionTitle>
              <Surface>
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
                      dealAmount: link.dealAmountCents !== null ? String(link.dealAmountCents / 100) : "",
                      dealCurrency: link.dealCurrency ?? "EUR",
                      decisionDeadline: link.decisionDeadline?.toISOString().slice(0, 10) ?? "",
                      decisionMakerName: link.decisionMakerName ?? "",
                      decisionMakerRole: link.decisionMakerRole ?? "",
                      sellerNotes: link.sellerNotes ?? "",
                      referenceConsent: !!link.referenceConsentAt,
                    }}
                  />
                  <SnoozeControl
                    linkId={link.id}
                    snoozedUntil={link.snoozedUntil && link.snoozedUntil > now ? link.snoozedUntil.toISOString() : null}
                  />
                </div>
              </Surface>
            </section>

            <section>
              <SectionTitle hint="appels, réponses, rendez-vous">Noter un échange</SectionTitle>
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

/** Readers of a shared link, most recently active first: each one's own link and where it stands. */
async function loadSharedReaders(linkId: string, now: Date): Promise<SharedReader[]> {
  const links = await prisma.link.findMany({
    where: { parentLinkId: linkId, archivedAt: null },
    orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      dealStatus: true,
      lastActivityAt: true,
      createdAt: true,
      engagementScore: { select: { tier: true } },
      prospects: { select: { email: true, name: true, company: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  return links.map((reader) => {
    const prospect = reader.prospects[0];
    return {
      linkId: reader.id,
      label: prospect?.name ?? prospect?.email ?? "Lecteur",
      detail: [prospect?.name ? prospect.email : null, prospect?.company, `lu ${formatRelative(reader.lastActivityAt ?? reader.createdAt, now)}`]
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

/** What the reader did around the content, for a line of the timeline. */
function signalDetails(signals: { type: ViewSignalType; valueMs: number | null }[]) {
  const details: string[] = [];
  if (signals.some((s) => s.type === "EXTERNAL_OPEN")) {
    const awayMs = signals.reduce((sum, s) => sum + (s.type === "EXTERNAL_RETURN" ? (s.valueMs ?? 0) : 0), 0);
    details.push(awayMs > 0 ? `site ouvert, ≈ ${formatDuration(awayMs)} dessus` : "site ouvert dans un onglet");
  }
  if (signals.some((s) => s.type === "DOWNLOAD")) details.push("PDF téléchargé");
  if (signals.some((s) => s.type === "EXIT_PROMPT_OPENED")) details.push("a ouvert l'assistant en partant");
  return details;
}
