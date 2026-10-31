import { PenLine, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AutopilotBanner } from "@/components/dashboard/autopilot-banner";
import { MailboxBanner } from "@/components/dashboard/campaigns/mailbox-banner";
import { NewLinkButton } from "@/components/dashboard/create-link-form";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FirstSteps } from "@/components/dashboard/first-steps";
import { SectionTitle } from "@/components/dashboard/page-header";
import { ActivityFeed } from "@/components/dashboard/today/activity-feed";
import {
  FunnelStrip,
  HeatDistributionBar,
} from "@/components/dashboard/today/funnel";
import { LiveStrip } from "@/components/dashboard/today/live-strip";
import { PeriodTabs } from "@/components/dashboard/today/period-tabs";
import {
  ReadyLinks,
  type ReadyLink,
} from "@/components/dashboard/today/ready-links";
import {
  TodoList,
  UnopenedDeals,
  type UnopenedRow,
  type TodoRow,
} from "@/components/dashboard/today/todo-list";
import { buildTodayHeadline } from "@/components/dashboard/today-headline";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import { getAppOrigin } from "@/lib/app-origin";
import { documentUploadPrefix, pitchUploadPrefix } from "@/lib/blob";
import { dealAction } from "@/lib/closing/dashboard/deal-action";
import { buildFeed } from "@/lib/closing/dashboard/feed";
import {
  buildFunnel,
  buildHeatDistribution,
} from "@/lib/closing/dashboard/funnel";
import { dealDocumentMeta, dealLabel } from "@/lib/closing/dashboard/labels";
import { followupSender, followupSenderLabel } from "@/lib/closing/followups/sender";
import { parsePeriod, periodStart } from "@/lib/closing/dashboard/period";
import { pageHeat } from "@/lib/closing/dashboard/page-heat";
import type { AppT } from "@/lib/closing/dashboard/i18n";
import { compareDeals } from "@/lib/closing/dashboard/rank";
import {
  getFeedSource,
  getFreshValidations,
  getDraftsToReview,
  getFunnelFacts,
  getOpenDeals,
  getPageReadings,
  getSellerProgress,
  getUpcomingFollowups,
  sellerLinks,
  type OpenDeal,
} from "@/lib/closing/dashboard/queries";
import { sellerStage } from "@/lib/closing/dashboard/seller-stage";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { shareLink } from "@/lib/closing/link-url";
import { getWorkspaceLiveState } from "@/lib/closing/live";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { prisma } from "@/lib/db";
import { isOutreachOrg } from "@/lib/outreach/flag";
import { formatInTimeZone, formatRelative } from "@/lib/format";
import { shouldForceOnboarding } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("today.page");
  return { title: t("metaTitle") };
}

const TODO_LIMIT = 15;
const ASK_IF_SENT_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const FEED_LIMIT = 12;

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  // A seller's day is their own deals; the team view is /team
  const { user, organization, role, scope } = await requireWorkspace();
  const organizationId = organization.id;
  const { mailClient, onboardingCompletedAt } = await getSellerPrefs(
    user.id,
    organizationId,
  );
  const mine = { organizationId, ...sellerLinks(scope) };
  const now = new Date();
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const noRecipient = t("today.page.noRecipient");
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
    readyDrafts,
    progress,
    failingMailboxes,
  ] = await Promise.all([
    prisma.document.count({ where: { organizationId, archivedAt: null } }),
    prisma.document.findFirst({
      where: { organizationId, archivedAt: null, status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    // A signed deal stays here until the seller marks it won
    getOpenDeals(organizationId, { owner: scope, withValidated: true, withRevived: true }),
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
    // Links created when a file was dropped, not sent yet: those are the ones to send, not new ones
    prisma.link.findMany({
      where: {
        ...mine,
        archivedAt: null,
        draftAt: { not: null },
        isOnboardingTest: false,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        slug: true,
        name: true,
        copiedAt: true,
        document: { select: { name: true, displayTitle: true, docType: true } },
        prospects: {
          take: 1,
          select: { company: true, name: true, email: true },
        },
      },
    }),
    getSellerProgress(organizationId, scope),
    // A mailbox in error stops campaigns and their follow-ups: the seller learns it here, not in Settings
    isOutreachOrg(organizationId)
      ? prisma.mailbox.findMany({
          where: { organizationId, userId: user.id, status: "ERROR" },
          select: { email: true, lastError: true, provider: true },
        })
      : Promise.resolve([]),
  ]);
  // A fresh seller is walked through a first document once; anyone joining a workspace in use is not
  if (shouldForceOnboarding({ onboardingCompletedAt, documentCount }))
    redirect("/welcome");
  const uploadPrefix = documentUploadPrefix(organizationId);

  if (documentCount === 0) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="condensed max-w-2xl text-display">
            {t("today.page.welcomeTitle")}
          </h1>
          <p className="max-w-xl text-body text-muted-foreground">
            {t("today.page.welcomeBody")}
          </p>
        </div>
        <FirstSteps
          hasDocument={false}
          hasLink={false}
          hasRead={false}
          action={
            <UploadDropzone
              uploadPrefix={uploadPrefix}
              pitchUploadPrefix={pitchUploadPrefix(organizationId)}
            />
          }
        />
        {!mailClient && (
          <p className="text-sm text-muted-foreground">
            {t("today.page.mailClientQuestion")}{" "}
            <Link
              href="/welcome?step=tool"
              className="text-foreground underline underline-offset-4"
            >
              {t("today.page.mailClientLink")}
            </Link>
            .
          </p>
        )}
      </div>
    );
  }
  const stage = sellerStage(progress);
  // Never copied: still to send. Copied: gone out as far as the seller sees, it waits for its first
  // opening with the other unopened links, and after two days Clozer asks whether it really left
  const readyLinks: ReadyLink[] = readyDrafts
    .filter((draft) => !draft.copiedAt)
    .map((draft) => ({
      id: draft.id,
      ...shareLink(origin, { slug: draft.slug, document: draft.document, company: draft.prospects[0]?.company }),
      label: dealLabel(draft, noRecipient),
      documentName: draft.document.name,
    }));
  const copiedRows: UnopenedRow[] = readyDrafts
    .filter((draft) => draft.copiedAt)
    .map((draft) => ({
      id: draft.id,
      ...shareLink(origin, { slug: draft.slug, document: draft.document, company: draft.prospects[0]?.company }),
      label: dealLabel(draft, noRecipient),
      documentName: dealDocumentMeta(draft),
      askIfSent:
        now.getTime() - draft.copiedAt!.getTime() > ASK_IF_SENT_AFTER_MS,
    }));

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
        t,
        noRecipient,
      }),
    )
    .sort(compareDeals);
  // Links nobody opened yet have nothing to read off: one folded line, not a page of rows
  const isWaiting = (row: TodoRow) => !row.opened && row.dealStatus === "OPEN";
  const activeRows = rows.filter((row) => !isWaiting(row));
  const waitingRows: UnopenedRow[] = [
    ...copiedRows,
    ...rows.filter(isWaiting).map((row) => ({
      id: row.id,
      label: row.label,
      documentName: row.documentName,
      url: row.url,
      title: row.title,
    })),
  ];
  const distribution = buildHeatDistribution(
    rows.map((row) => ({ opened: row.opened, tier: row.tier })),
  );
  const funnel = buildFunnel(funnelFacts);
  const feed = buildFeed(feedSource, FEED_LIMIT, t);

  // The deal the day's headline is about: its AI line is not repeated in the list
  const focus =
    rows.find((row) => (row.aiPriority ?? 0) >= 4 && row.insightHeadline) ??
    null;
  const draftsToReview = deals.reduce((sum, deal) => sum + deal.draftCount, 0);
  const { headline, hint } = buildTodayHeadline(t, {
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
    // A copied link went out as far as the seller knows: it waits for its opening, it is not "to create"
    activeCount: deals.length + copiedRows.length,
    documentCount,
    unopenedCount: distribution.unopened + copiedRows.length,
    nextFollowupLabel: upcomingFollowups[0]
      ? formatRelative(upcomingFollowups[0].scheduledFor, locale, now)
      : null,
    aiFocus: focus
      ? { label: focus.label, headline: focus.insightHeadline! }
      : null,
    draftsToReview,
    readyLinks: readyLinks.length
      ? { count: readyLinks.length, documentName: readyLinks[0].documentName }
      : null,
  });

  const periodHint = t(`today.period.${period}.hint`);
  // Until a first reading the checklist stays on top of the page. A deal already to handle
  // (marked validated after a call, say) ends that, read or not.
  const firstRun = stage !== "reading" && activeRows.length === 0;
  const nothingToHandle = rows.length === 0 && copiedRows.length === 0;
  // No link out yet and none waiting under "À envoyer": the checklist carries the button
  const createLink =
    readyLinks.length === 0 && latestReadyDocument ? (
      <NewLinkButton
        documentId={latestReadyDocument.id}
        label={t("today.page.createLink")}
      />
    ) : null;

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <p className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border pb-2 font-mono text-micro text-muted-foreground">
          <span className="text-foreground">{t("today.page.reportTitle")}</span>
          <span>{reportDate(now, locale)}</span>
          <span>{t("today.page.dealsInProgress", { count: deals.length })}</span>
        </p>
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="condensed text-title text-balance sm:text-display">
              {headline}
            </h1>
            <p className="text-body text-muted-foreground">{hint}</p>
          </div>
        </div>
        <LiveStrip key={live.stamp} initial={live} />
        {failingMailboxes.length > 0 && (
          <MailboxBanner
            mailboxes={failingMailboxes}
            hasActive={false}
            lead={t("campaigns.banner.todayLead")}
          />
        )}
        {draftsToReview > 1 && (
          <Link
            href="/drafts"
            className="flex items-center justify-between gap-3 border-y border-foreground bg-card px-4 py-3 text-body hover:bg-muted/50"
          >
            <span>{t("alerts.digest.draftsLine", { count: draftsToReview })}</span>
            <span className="font-medium">{t("alerts.digest.reviewButton")} →</span>
          </Link>
        )}
        {settings.autonomy === "AUTOPILOT" && (
          <AutopilotBanner
            sentToday={sentAlone}
            canPause={isManagerRole(role)}
          />
        )}
      </section>

      <div
        className={cn(
          "grid grid-cols-1 gap-12",
          "lg:grid-cols-[minmax(0,1fr)_18rem]",
        )}
      >
        <div className="min-w-0 space-y-12">
          {firstRun && (
            <FirstSteps
              hasDocument
              hasLink={stage === "waiting"}
              hasRead={false}
              readyLinks={readyLinks.length}
              action={stage === "unsent" ? createLink : null}
            />
          )}
          {readyLinks.length > 0 && (
            <section id="a-envoyer" className="scroll-mt-20">
              <SectionTitle hint={t("today.page.toSendHint")}>
                {t("today.page.toSend")}
              </SectionTitle>
              <ReadyLinks links={readyLinks} />
            </section>
          )}

          <section>
            <SectionTitle hint={t("today.page.toHandleHint")}>
              {t("today.page.toHandle")}
            </SectionTitle>
            {nothingToHandle ? (
              <EmptyState
                title={t("today.page.emptyTitle")}
                description={t("today.page.emptyDescription")}
                // The checklist above already carries the button while it is shown
                action={
                  !firstRun &&
                  readyLinks.length === 0 &&
                  latestReadyDocument && (
                    <NewLinkButton
                      documentId={latestReadyDocument.id}
                      variant="outline"
                      label={t("today.page.createLink")}
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
                    {t("today.page.moreDeals", { count: activeRows.length - TODO_LIMIT })}
                  </p>
                )}
                {waitingRows.length > 0 && <UnopenedDeals rows={waitingRows} />}
              </>
            )}
          </section>

          <section>
            <SectionTitle
              hint={t("today.page.sendsHint", { period: periodHint })}
              action={<PeriodTabs current={period} />}
            >
              {t("today.page.sends")}
            </SectionTitle>
            <FunnelStrip funnel={funnel} />
          </section>
        </div>

        <aside className="space-y-10">
          <section>
            <SectionTitle hint={t("today.page.openDealsHint")}>{t("today.page.openDeals")}</SectionTitle>
            <HeatDistributionBar distribution={distribution} />
          </section>

          {drafts.length > 0 && (
            <section>
              <SectionTitle
                hint={t(
                  settings.autonomy === "AUTOPILOT"
                    ? "today.page.draftsHintAutopilot"
                    : "today.page.draftsHint",
                )}
              >
                {t("today.page.draftsTitle")}
              </SectionTitle>
              <ul className="space-y-3 text-sm">
                {drafts.map((draft) => {
                  const campaign = draft.campaignProspect?.campaign;
                  const sender = followupSenderLabel(
                    followupSender({
                      sentVia: draft.sentVia,
                      campaign: campaign
                        ? { name: campaign.name, mailbox: campaign.mailbox?.email ?? null }
                        : null,
                    }),
                    settings.senderName,
                  );
                  return (
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
                          {t(`labels.channel.${draft.channel}`)}
                          {draft.subject ? ` : ${draft.subject}` : ""}
                        </p>
                        <p className="text-small text-muted-foreground">
                          {t("today.page.draftGoesOut", {
                            date: formatInTimeZone(draft.scheduledFor, draft.timezone, locale),
                          })}{" "}
                          {t(`labels.followupSender.${sender.key}`, sender.values)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle hint={periodHint}>
              {t("today.page.feedTitle")}
            </SectionTitle>
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("today.page.feedEmpty")}
              </p>
            ) : (
              <ActivityFeed items={feed} now={now} />
            )}
          </section>

          {upcomingFollowups.length > 0 && (
            <section>
              <SectionTitle>{t("today.page.upcomingTitle")}</SectionTitle>
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
                        title={t("today.page.prospectTime", {
                          time: formatInTimeZone(followup.scheduledFor, followup.timezone, locale),
                        })}
                      >
                        {t(`labels.channel.${followup.channel}`)}{" "}
                        {formatRelative(followup.scheduledFor, locale, now)}
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

// Sellers are in France for now; the date only labels the report.
function reportDate(now: Date, locale: UiLocale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
}

function toTodoRow(
  deal: OpenDeal,
  {
    now,
    readingNow,
    origin,
    pages,
    t,
    noRecipient,
  }: {
    now: Date;
    readingNow: boolean;
    origin: string;
    t: AppT;
    noRecipient: string;
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
    label: dealLabel(deal, noRecipient),
    company: prospect?.company ?? null,
    contact: prospect ? (prospect.name ?? prospect.email) : null,
    documentName: dealDocumentMeta(deal),
    tier,
    score,
    state: dealState(t, deal.dealStatus, deal.opened, tier),
    lastActivityAt: deal.lastActivityAt,
    action,
    insightHeadline,
    aiPriority,
    ...shareLink(origin, { slug: deal.slug, document: deal.document, company: prospect?.company }),
    heat: pages ? pageHeat(pages, deal.document.numPages) : null,
  };
}

function dealState(
  t: AppT,
  dealStatus: TodoRow["dealStatus"],
  opened: boolean,
  tier: TodoRow["tier"],
) {
  if (dealStatus !== "OPEN") return t(`labels.dealStatus.${dealStatus}`);
  if (!opened) return t("today.page.stateUnopened");
  return tier ? t(`labels.tier.${tier}`) : t("today.page.stateOpened");
}
