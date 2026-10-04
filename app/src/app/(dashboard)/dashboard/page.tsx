import { PenLine, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AutopilotBanner } from "@/components/dashboard/autopilot-banner";
import { NewLinkDialog } from "@/components/dashboard/create-link-form";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FirstSteps } from "@/components/dashboard/first-steps";
import {
  CHANNEL_LABELS,
  DEAL_STATUS_LABELS,
  INSIGHT_ACTION_LABELS,
  TIER_LABELS,
  TIMING_LABELS,
} from "@/components/dashboard/labels";
import { SectionTitle } from "@/components/dashboard/page-header";
import { ActivityFeed } from "@/components/dashboard/today/activity-feed";
import { FunnelStrip, HeatDistributionBar } from "@/components/dashboard/today/funnel";
import { LiveStrip } from "@/components/dashboard/today/live-strip";
import { PeriodTabs } from "@/components/dashboard/today/period-tabs";
import { TodoList, type TodoRow } from "@/components/dashboard/today/todo-list";
import { buildTodayHeadline } from "@/components/dashboard/today-headline";
import { UploadButton, UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { getAppOrigin } from "@/lib/app-origin";
import { documentUploadPrefix } from "@/lib/blob";
import { buildFeed } from "@/lib/closing/dashboard/feed";
import { buildFunnel, buildHeatDistribution } from "@/lib/closing/dashboard/funnel";
import { prospectLabel } from "@/lib/closing/dashboard/labels";
import { computeNextAction, withAiAdvice } from "@/lib/closing/dashboard/next-action";
import { parsePeriod, periodStart, PERIODS } from "@/lib/closing/dashboard/period";
import { compareDeals } from "@/lib/closing/dashboard/rank";
import {
  getFeedSource,
  getFreshValidations,
  getDraftsToReview,
  getFunnelFacts,
  getOpenDeals,
  getUpcomingFollowups,
  type OpenDeal,
} from "@/lib/closing/dashboard/queries";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { getWorkspaceLiveState } from "@/lib/closing/live";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { prisma } from "@/lib/db";
import { formatInTimeZone, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Aujourd'hui" };

const TODO_LIMIT = 15;
const FEED_LIMIT = 12;

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { organization } = await requireWorkspace();
  const organizationId = organization.id;
  const now = new Date();
  const period = parsePeriod((await props.searchParams).p);
  catchUpInBackground({ organizationId });
  const since = periodStart(period, now);

  const [
    documentCount,
    latestReadyDocument,
    deals,
    funnelFacts,
    feedSource,
    upcomingFollowups,
    drafts,
    freshValidations,
    live,
    origin,
    settings,
    sentAlone,
    linkCount,
    firstRead,
  ] = await Promise.all([
    prisma.document.count({ where: { organizationId, archivedAt: null } }),
    prisma.document.findFirst({
      where: { organizationId, archivedAt: null, status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    getOpenDeals(organizationId),
    getFunnelFacts(organizationId, since),
    getFeedSource(organizationId, since),
    getUpcomingFollowups(organizationId),
    getDraftsToReview(organizationId),
    getFreshValidations(organizationId, now),
    getWorkspaceLiveState(organizationId, now),
    getAppOrigin(),
    getWorkspaceSettings(organizationId),
    prisma.followup.count({
      where: {
        link: { organizationId },
        status: { in: ["SENT", "DELIVERED"] },
        sentVia: "PLATFORM",
        approvedAt: null,
        sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.link.count({ where: { organizationId, archivedAt: null } }),
    // Bots and the seller's own reads are flagged isBot
    prisma.documentView.findFirst({ where: { link: { organizationId }, isBot: false }, select: { id: true } }),
  ]);
  const uploadPrefix = documentUploadPrefix(organizationId);

  if (documentCount === 0) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="max-w-2xl text-display [font-stretch:88%]">Bienvenue sur Clozer.</h1>
          <p className="max-w-xl text-body text-muted-foreground">
            Trois étapes, et vous verrez ici qui lit vos propositions et qui relancer.
          </p>
        </div>
        <FirstSteps
          hasDocument={false}
          hasLink={false}
          hasRead={false}
          action={<UploadDropzone uploadPrefix={uploadPrefix} />}
        />
      </div>
    );
  }
  const showFirstSteps = linkCount === 0 || !firstRead;

  const readingLinks = new Set(live.readers.map((reader) => reader.linkId));
  const rows = deals
    .map((deal) => toTodoRow(deal, { now, readingNow: readingLinks.has(deal.id), origin }))
    .sort(compareDeals);
  const distribution = buildHeatDistribution(rows.map((row) => ({ opened: row.opened, tier: row.tier })));
  const funnel = buildFunnel(funnelFacts);
  const feed = buildFeed(feedSource, FEED_LIMIT);

  const { headline, hint } = buildTodayHeadline({
    // "Hot" by the score alone, unless the analysis reads the deal as calm
    hotProspects: rows
      .filter((row) => row.dealStatus === "OPEN" && row.tier === "HOT" && (row.aiPriority ?? 5) >= 4)
      .map((row) => row.label),
    warmCount: distribution.WARM,
    changeRequests: rows.filter((row) => row.dealStatus === "CHANGE_REQUESTED").map((row) => row.label),
    freshValidations,
    activeCount: deals.length,
    documentCount,
    unopenedCount: distribution.unopened,
    nextFollowupLabel: upcomingFollowups[0] ? formatRelative(upcomingFollowups[0].scheduledFor, now) : null,
    aiFocus: (() => {
      const focus = rows.find((row) => (row.aiPriority ?? 0) >= 4 && row.insightHeadline);
      return focus ? { label: focus.label, headline: focus.insightHeadline! } : null;
    })(),
    draftsToReview: deals.reduce((sum, deal) => sum + deal.draftCount, 0),
  });

  const periodHint = PERIODS[period].hint;

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="max-w-3xl text-title text-balance [font-stretch:88%] sm:text-display">
            {headline}
            <span className="block text-muted-foreground">{hint}</span>
          </h1>
          <div className="shrink-0 sm:pt-1.5">
            <UploadButton uploadPrefix={uploadPrefix} />
          </div>
        </div>
        <LiveStrip key={live.stamp} initial={live} />
        {settings.autonomy === "AUTOPILOT" && <AutopilotBanner sentToday={sentAlone} />}
        {showFirstSteps && (
          <FirstSteps
            hasDocument
            hasLink={linkCount > 0}
            hasRead={!!firstRead}
            action={
              linkCount === 0 &&
              latestReadyDocument && <NewLinkDialog documentId={latestReadyDocument.id} disabled={false} />
            }
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-12">
          <section>
            <SectionTitle hint="du plus urgent au moins urgent">À traiter</SectionTitle>
            {rows.length === 0 ? (
              <EmptyState
                title="Aucun deal en cours."
                description={
                  latestReadyDocument
                    ? `Créez un lien pour « ${latestReadyDocument.name} » et envoyez-le à votre prospect. Il apparaîtra ici avec ce qu'il y a à faire.`
                    : "Ouvrez un document et créez un lien par prospect. Chacun apparaîtra ici avec ce qu'il y a à faire."
                }
                action={
                  latestReadyDocument && (
                    <NewLinkDialog documentId={latestReadyDocument.id} disabled={false} variant="outline" />
                  )
                }
              />
            ) : (
              <>
                <TodoList rows={rows.slice(0, TODO_LIMIT)} now={now} />
                {rows.length > TODO_LIMIT && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Et {rows.length - TODO_LIMIT} autres deals en cours, moins urgents.
                  </p>
                )}
              </>
            )}
          </section>

          <section>
            <SectionTitle hint={periodHint} action={<PeriodTabs current={period} />}>
              Vos envois
            </SectionTitle>
            <FunnelStrip funnel={funnel} />
          </section>
        </div>

        <aside className="space-y-10">
          <section>
            <SectionTitle hint="en ce moment">Deals en cours</SectionTitle>
            <HeatDistributionBar distribution={distribution} />
          </section>

          {drafts.length > 0 && (
            <section>
              <SectionTitle hint="rien ne part sans vous">Relances à valider</SectionTitle>
              <ul className="space-y-3 text-sm">
                {drafts.map((draft) => (
                  <li key={draft.id} className="flex gap-3">
                    <PenLine className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Link href={`/links/${draft.link.id}#relances`} className="font-medium hover:underline">
                        {draft.prospect.company ?? draft.prospect.name ?? draft.prospect.email}
                      </Link>
                      <p className="truncate text-muted-foreground">
                        {CHANNEL_LABELS[draft.channel]}
                        {draft.subject ? ` : ${draft.subject}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle hint={periodHint}>Ce qui s&apos;est passé</SectionTitle>
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Les lectures, les réponses de vos prospects et les relances envoyées s&apos;afficheront ici.
              </p>
            ) : (
              <ActivityFeed items={feed} now={now} />
            )}
          </section>

          {upcomingFollowups.length > 0 && (
            <section>
              <SectionTitle>Relances à venir</SectionTitle>
              <ul className="space-y-3 text-sm">
                {upcomingFollowups.map((followup) => (
                  <li key={followup.id} className="flex gap-3">
                    <Send className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Link href={`/links/${followup.link.id}`} className="font-medium hover:underline">
                        {followup.prospect.company ?? followup.prospect.name ?? followup.prospect.email}
                      </Link>
                      <p
                        className="text-muted-foreground"
                        title={`${formatInTimeZone(followup.scheduledFor, followup.timezone)}, heure du prospect`}
                      >
                        {CHANNEL_LABELS[followup.channel]} {formatRelative(followup.scheduledFor, now)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function toTodoRow(
  deal: OpenDeal,
  { now, readingNow, origin }: { now: Date; readingNow: boolean; origin: string },
): TodoRow {
  const prospect = deal.prospects[0];
  const ai = currentInsight(deal);
  const tier = deal.opened ? (deal.engagementScore?.tier ?? null) : null;

  return {
    id: deal.id,
    dealStatus: deal.dealStatus,
    opened: deal.opened,
    label: prospectLabel(deal),
    company: prospect?.company ?? null,
    contact: prospect ? (prospect.name ?? prospect.email) : null,
    documentName: deal.document.name,
    tier,
    score: deal.opened ? (deal.engagementScore?.score ?? 0) : 0,
    state: dealState(deal.dealStatus, deal.opened, tier),
    lastActivityAt: deal.lastActivityAt,
    action: withAiAdvice(
      computeNextAction({
      now,
      dealStatus: deal.dealStatus,
      readingNow,
      opened: deal.opened,
      tier,
      pricingFocus: deal.pricingFocus,
      lastActivityAt: deal.lastActivityAt,
      sentAt: deal.sentAt ?? deal.createdAt,
      followupsEnabled: deal.followupsEnabled,
      nextFollowup: deal.followups[0] ?? null,
      draftToReview: deal.draftCount > 0,
      lastSellerContactAt: deal.lastSellerContactAt,
      snoozedUntil: deal.snoozedUntil,
      }),
      ai.advice,
      { action: INSIGHT_ACTION_LABELS, timing: TIMING_LABELS },
    ),
    insightHeadline: ai.insightHeadline,
    aiPriority: ai.aiPriority,
    url: `${origin}/v/${deal.slug}`,
  };
}

function dealState(dealStatus: TodoRow["dealStatus"], opened: boolean, tier: TodoRow["tier"]) {
  if (dealStatus !== "OPEN") return DEAL_STATUS_LABELS[dealStatus];
  if (!opened) return "Pas encore ouvert";
  return tier ? TIER_LABELS[tier] : "Ouvert";
}

// An analysis older than the last reading no longer describes the deal
function currentInsight(deal: OpenDeal) {
  const current = deal.insight && (!deal.lastActivityAt || deal.insight.createdAt >= deal.lastActivityAt);
  const action = deal.insight?.recommendedAction as { type: string; timing: string } | undefined;
  return {
    insightHeadline: current ? deal.insight!.headline : null,
    aiPriority: current ? deal.insight!.priority : null,
    advice: current && action ? { type: action.type, timing: action.timing, priority: deal.insight!.priority } : null,
  };
}

