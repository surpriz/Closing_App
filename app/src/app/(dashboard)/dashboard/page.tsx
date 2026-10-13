import { PenLine, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AutopilotBanner } from "@/components/dashboard/autopilot-banner";
import { NewLinkButton } from "@/components/dashboard/create-link-form";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FirstSteps } from "@/components/dashboard/first-steps";
import {
  CHANNEL_LABELS,
  DEAL_STATUS_LABELS,
  TIER_LABELS,
} from "@/components/dashboard/labels";
import { SectionTitle } from "@/components/dashboard/page-header";
import { ActivityFeed } from "@/components/dashboard/today/activity-feed";
import {
  FunnelStrip,
  HeatDistributionBar,
} from "@/components/dashboard/today/funnel";
import { LiveStrip } from "@/components/dashboard/today/live-strip";
import { PeriodTabs } from "@/components/dashboard/today/period-tabs";
import { TodoList, UnopenedDeals, type TodoRow } from "@/components/dashboard/today/todo-list";
import { buildTodayHeadline } from "@/components/dashboard/today-headline";
import {
  UploadButton,
  UploadDropzone,
} from "@/components/dashboard/upload-dropzone";
import { getAppOrigin } from "@/lib/app-origin";
import { documentUploadPrefix, pitchUploadPrefix } from "@/lib/blob";
import { dealAction } from "@/lib/closing/dashboard/deal-action";
import { buildFeed } from "@/lib/closing/dashboard/feed";
import {
  buildFunnel,
  buildHeatDistribution,
} from "@/lib/closing/dashboard/funnel";
import { dealDocumentMeta, dealLabel } from "@/lib/closing/dashboard/labels";
import {
  parsePeriod,
  periodStart,
  PERIODS,
} from "@/lib/closing/dashboard/period";
import { pageHeat } from "@/lib/closing/dashboard/page-heat";
import { compareDeals } from "@/lib/closing/dashboard/rank";
import {
  getFeedSource,
  getFreshValidations,
  getDraftsToReview,
  getFunnelFacts,
  getOpenDeals,
  getPageReadings,
  getUpcomingFollowups,
  sellerLinks,
  type OpenDeal,
} from "@/lib/closing/dashboard/queries";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { getWorkspaceLiveState } from "@/lib/closing/live";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { prisma } from "@/lib/db";
import { formatInTimeZone, formatRelative } from "@/lib/format";
import { shouldForceOnboarding } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Aujourd'hui" };

const TODO_LIMIT = 15;
const FEED_LIMIT = 12;

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  // A seller's day is their own deals; the team view is /equipe
  const { user, organization, role, scope } = await requireWorkspace();
  const organizationId = organization.id;
  const { mailClient, onboardingCompletedAt } = await getSellerPrefs(user.id, organizationId);
  const mine = { organizationId, ...sellerLinks(scope) };
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
    // A signed deal stays here until the seller marks it won
    getOpenDeals(organizationId, { owner: scope, withValidated: true }),
    getFunnelFacts(organizationId, since, scope),
    getFeedSource(organizationId, since, scope),
    getUpcomingFollowups(organizationId, scope),
    getDraftsToReview(organizationId, scope),
    getFreshValidations(organizationId, now, scope),
    getWorkspaceLiveState(organizationId, now, scope),
    getAppOrigin(),
    getWorkspaceSettings(organizationId),
    prisma.followup.count({
      where: {
        link: mine,
        status: { in: ["SENT", "DELIVERED"] },
        sentVia: "PLATFORM",
        approvedAt: null,
        sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.link.count({ where: { ...mine, archivedAt: null, draftAt: null } }),
    // Bots and the seller's own reads are flagged isBot; the tour's test link is not a prospect
    prisma.documentView.findFirst({
      where: { link: { ...mine, isOnboardingTest: false }, isBot: false },
      select: { id: true },
    }),
  ]);
  // A fresh seller is walked through a first document once; anyone joining a workspace in use is not
  if (shouldForceOnboarding({ onboardingCompletedAt, documentCount })) redirect("/bienvenue");
  const uploadPrefix = documentUploadPrefix(organizationId);
  const pitchPrefix = pitchUploadPrefix(organizationId);

  if (documentCount === 0) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="condensed max-w-2xl text-display">
            Bienvenue sur Clozer.
          </h1>
          <p className="max-w-xl text-body text-muted-foreground">
            Déposez un devis ou une proposition : le lien à envoyer est prêt
            dans la seconde.
          </p>
        </div>
        <FirstSteps
          hasDocument={false}
          hasLink={false}
          hasRead={false}
          action={
            <UploadDropzone
              uploadPrefix={uploadPrefix}
              pitchUploadPrefix={pitchPrefix}
            />
          }
        />
        {!mailClient && (
          <p className="text-sm text-muted-foreground">
            Vous envoyez depuis Gmail ou Outlook ?{" "}
            <Link
              href="/bienvenue?etape=outil"
              className="text-foreground underline underline-offset-4"
            >
              Clozer peut créer le lien directement dans vos emails
            </Link>
            .
          </p>
        )}
      </div>
    );
  }
  const showFirstSteps = linkCount === 0 || !firstRead;

  const readingLinks = new Set(live.readers.map((reader) => reader.linkId));
  const readings = await getPageReadings(
    deals.filter((deal) => deal.opened).map((deal) => deal.id),
  );
  const rows = deals
    .map((deal) =>
      toTodoRow(deal, {
        now,
        readingNow: readingLinks.has(deal.id),
        origin,
        pages: readings.get(deal.id) ?? null,
      }),
    )
    .sort(compareDeals);
  // Links nobody opened yet have nothing to read off: one folded line, not a page of rows
  const isWaiting = (row: TodoRow) => !row.opened && row.dealStatus === "OPEN";
  const activeRows = rows.filter((row) => !isWaiting(row));
  const waitingRows = rows.filter(isWaiting);
  const distribution = buildHeatDistribution(
    rows.map((row) => ({ opened: row.opened, tier: row.tier })),
  );
  const funnel = buildFunnel(funnelFacts);
  const feed = buildFeed(feedSource, FEED_LIMIT);

  // The deal the day's headline is about: its AI line is not repeated in the list
  const focus =
    rows.find((row) => (row.aiPriority ?? 0) >= 4 && row.insightHeadline) ??
    null;
  const { headline, hint } = buildTodayHeadline({
    // "Hot" by the score alone, unless the analysis reads the deal as calm
    hotProspects: rows
      .filter(
        (row) =>
          row.dealStatus === "OPEN" &&
          row.tier === "HOT" &&
          (row.aiPriority ?? 5) >= 4,
      )
      .map((row) => row.label),
    warmCount: distribution.WARM,
    changeRequests: rows
      .filter((row) => row.dealStatus === "CHANGE_REQUESTED")
      .map((row) => row.label),
    freshValidations,
    activeCount: deals.length,
    documentCount,
    unopenedCount: distribution.unopened,
    nextFollowupLabel: upcomingFollowups[0]
      ? formatRelative(upcomingFollowups[0].scheduledFor, now)
      : null,
    aiFocus: focus
      ? { label: focus.label, headline: focus.insightHeadline! }
      : null,
    draftsToReview: deals.reduce((sum, deal) => sum + deal.draftCount, 0),
  });

  const periodHint = PERIODS[period].hint;

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <p className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border pb-2 font-mono text-micro text-muted-foreground">
          <span className="text-foreground">Rapport du jour</span>
          <span>{reportDate(now)}</span>
          <span>
            {deals.length} deal{deals.length > 1 ? "s" : ""} en cours
          </span>
        </p>
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="condensed text-title text-balance sm:text-display">
              {headline}
            </h1>
            <p className="text-body text-muted-foreground">{hint}</p>
          </div>
          <div className="shrink-0">
            <UploadButton
              uploadPrefix={uploadPrefix}
              pitchUploadPrefix={pitchPrefix}
            />
          </div>
        </div>
        <LiveStrip key={live.stamp} initial={live} />
        {settings.autonomy === "AUTOPILOT" && (
          <AutopilotBanner
            sentToday={sentAlone}
            canPause={isManagerRole(role)}
          />
        )}
        {showFirstSteps && (
          <FirstSteps
            hasDocument
            hasLink={linkCount > 0}
            hasRead={!!firstRead}
            action={
              linkCount === 0 &&
              latestReadyDocument && (
                <NewLinkButton documentId={latestReadyDocument.id} />
              )
            }
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-12">
          <section>
            <SectionTitle hint="du plus urgent au moins urgent">
              À traiter
            </SectionTitle>
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
                    <NewLinkButton
                      documentId={latestReadyDocument.id}
                      variant="outline"
                    />
                  )
                }
              />
            ) : (
              <>
                {activeRows.length > 0 && (
                  <TodoList
                    rows={activeRows.slice(0, TODO_LIMIT)}
                    now={now}
                    headlineDealId={focus?.id ?? null}
                  />
                )}
                {activeRows.length > TODO_LIMIT && (
                  <p className="mt-3 text-small text-muted-foreground">
                    Et {activeRows.length - TODO_LIMIT} autres deals en cours,
                    moins urgents.
                  </p>
                )}
                {waitingRows.length > 0 && (
                  <UnopenedDeals rows={waitingRows} />
                )}
              </>
            )}
          </section>

          <section>
            <SectionTitle
              hint={`où en sont les liens envoyés, ${periodHint}`}
              action={<PeriodTabs current={period} />}
            >
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
              <SectionTitle hint="rien ne part sans vous">
                Relances à valider
              </SectionTitle>
              <ul className="space-y-3 text-sm">
                {drafts.map((draft) => (
                  <li key={draft.id} className="flex gap-3">
                    <PenLine className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Link
                        href={`/links/${draft.link.id}#relances`}
                        className="font-medium hover:underline"
                      >
                        {draft.prospect.company ??
                          draft.prospect.name ??
                          draft.prospect.email}
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
            <SectionTitle hint={periodHint}>
              Ce qui s&apos;est passé
            </SectionTitle>
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Les lectures, les réponses de vos prospects et les relances
                envoyées s&apos;afficheront ici.
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
                      <Link
                        href={`/links/${followup.link.id}`}
                        className="font-medium hover:underline"
                      >
                        {followup.prospect.company ??
                          followup.prospect.name ??
                          followup.prospect.email}
                      </Link>
                      <p
                        className="text-muted-foreground"
                        title={`${formatInTimeZone(followup.scheduledFor, followup.timezone)}, heure du prospect`}
                      >
                        {CHANNEL_LABELS[followup.channel]}{" "}
                        {formatRelative(followup.scheduledFor, now)}
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
  {
    now,
    readingNow,
    origin,
    pages,
  }: {
    now: Date;
    readingNow: boolean;
    origin: string;
    /** Reading time per page, null when the link was never opened. */
    pages: { pageNumber: number; durationMs: number }[] | null;
  },
): TodoRow {
  const prospect = deal.prospects[0];
  const { action, tier, score, insightHeadline, aiPriority } = dealAction(
    deal,
    now,
    readingNow,
  );

  return {
    id: deal.id,
    dealStatus: deal.dealStatus,
    opened: deal.opened,
    label: dealLabel(deal),
    company: prospect?.company ?? null,
    contact: prospect ? (prospect.name ?? prospect.email) : null,
    documentName: dealDocumentMeta(deal),
    tier,
    score,
    state: dealState(deal.dealStatus, deal.opened, tier),
    lastActivityAt: deal.lastActivityAt,
    action,
    insightHeadline,
    aiPriority,
    url: `${origin}/v/${deal.slug}`,
    heat: pages ? pageHeat(pages, deal.document.numPages) : null,
  };
}

// Sellers are in France for now; the date only labels the report.
function reportDate(now: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
}

function dealState(
  dealStatus: TodoRow["dealStatus"],
  opened: boolean,
  tier: TodoRow["tier"],
) {
  if (dealStatus !== "OPEN") return DEAL_STATUS_LABELS[dealStatus];
  if (!opened) return "Pas encore ouvert";
  return tier ? TIER_LABELS[tier] : "Ouvert";
}
