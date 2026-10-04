import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline, type TimelineItem } from "@/components/dashboard/activity-timeline";
import { ArchiveLinkButton } from "@/components/dashboard/archive-link-button";
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
  FOLLOWUP_TRIGGER_LABELS,
  SCORE_REASON_LABELS,
  SELLER_ACTIVITY_LABELS,
  TIER_LABELS,
} from "@/components/dashboard/labels";
import { LinkSettingsDialog } from "@/components/dashboard/link-settings-form";
import { LinkTestTools } from "@/components/dashboard/link-test-tools";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { SectionTitle, StatLine, Surface } from "@/components/dashboard/page-header";
import { PageTimeChart, type PageTimeDatum } from "@/components/dashboard/page-time-chart";
import { ProspectForm } from "@/components/dashboard/prospect-form";
import { SellerActivityForm, SnoozeControl } from "@/components/dashboard/seller-activity-form";
import { ScoreGuide, TemperatureGauge } from "@/components/dashboard/temperature";
import { getAppOrigin } from "@/lib/app-origin";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { getLinkAnalytics } from "@/lib/closing/analytics";
import { getLatestInsight } from "@/lib/closing/brain/latest";
import { labelReaders } from "@/lib/closing/dashboard/readers";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { freshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { getLinkLiveState } from "@/lib/closing/live";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import type { EngagementReason } from "@/lib/closing/types";
import { prisma } from "@/lib/db";
import { formatDuration, formatRelative } from "@/lib/format";
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

export default async function LinkDetailPage({ params }: PageProps<"/links/[id]">) {
  const { id } = await params;
  const { organization } = await requireWorkspace();

  const link = await prisma.link.findFirst({
    where: { id, organizationId: organization.id, archivedAt: null },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          kind: true,
          pages: { select: { pageNumber: true, tags: true, summary: true }, orderBy: { pageNumber: "asc" } },
        },
      },
      prospects: { orderBy: { createdAt: "asc" } },
      engagementScore: true,
    },
  });
  if (!link) notFound();

  const score = await freshEngagementScore(link.id, link.engagementScore);
  catchUpInBackground({ organizationId: organization.id, linkId: link.id, documentId: link.document.id });

  const [analytics, settings, origin, followups, alerts, actions, live, sellerActivities, insight] = await Promise.all([
    getLinkAnalytics(link.id),
    getWorkspaceSettings(organization.id),
    getAppOrigin(),
    prisma.followup.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { prospect: { select: { name: true, email: true } } },
    }),
    prisma.sellerAlert.findMany({ where: { linkId: link.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.prospectAction.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { prospect: { select: { name: true, email: true } } },
    }),
    getLinkLiveState(link.id),
    prisma.sellerActivity.findMany({ where: { linkId: link.id }, orderBy: { occurredAt: "desc" }, take: 20 }),
    getLatestInsight(link.id),
  ]);
  const insightRecipient = insight?.recommendedAction.prospectId
    ? link.prospects.find((p) => p.id === insight.recommendedAction.prospectId)
    : null;

  const mainProspect = link.prospects[0];
  const title = mainProspect?.company ?? link.name ?? mainProspect?.email ?? link.slug;
  const url = `${origin}/v/${link.slug}`;

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

  const readerLabels = labelReaders(analytics.recentViews);
  const timeline: TimelineItem[] = [
    { id: `created-${link.id}`, at: link.createdAt, kind: "created" as const, title: "Lien créé" },
    ...analytics.recentViews.map((view) => ({
      id: `view-${view.id}`,
      at: view.startedAt,
      kind: "view" as const,
      title: `Lecture par ${readerLabels.get(view.id)?.name ?? "un lecteur"}`,
      detail: [
        formatDuration(view.totalDurationMs),
        link.document.kind === "URL" ? null : `jusqu'à la page ${view.maxPageReached}`,
        [view.deviceType, view.browser].filter(Boolean).join(" "),
        view.timezone,
      ]
        .filter(Boolean)
        .join(", "),
    })),
    ...actions.map((action) => ({
      id: `action-${action.id}`,
      at: action.createdAt,
      kind: action.type === "VALIDATE_SIGN" ? ("validated" as const) : ("change" as const),
      title: `${action.prospect?.name ?? action.prospect?.email ?? "Le prospect"} ${
        action.type === "VALIDATE_SIGN" ? "a validé la proposition" : "demande un ajustement"
      }`,
      detail: action.message ? `« ${action.message} »` : null,
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
      const payload = alert.payload as { liveViewers?: number; inactiveDays?: number };
      return {
        id: `alert-${alert.id}`,
        at: alert.createdAt,
        kind: "alert" as const,
        title: `Alerte : ${ALERT_TYPE_LABELS[alert.type].toLowerCase()}`,
        detail: payload.liveViewers
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
  const contactLine = [mainProspect?.company ? mainProspect.name : null, mainProspect?.email]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-10">
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
          <div className="flex flex-wrap items-center gap-2">
            <DealStatusSelect linkId={link.id} status={link.dealStatus} />
            <LinkSettingsDialog
              linkId={link.id}
              initial={{
                // Not updatedAt: it moves on every tracking flush and the page refreshes itself
                version: [link.name, link.requireEmail, link.ctaEnabled, link.followupsEnabled].join("|"),
                name: link.name ?? "",
                requireEmail: link.requireEmail,
                ctaEnabled: link.ctaEnabled,
                followupsEnabled: link.followupsEnabled,
              }}
            />
            <ArchiveLinkButton linkId={link.id} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <LiveActivity
          key={live.stamp}
          linkId={link.id}
          initial={live}
          pageCount={link.document.kind === "URL" ? null : link.document.pages.length}
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
                    <span className="size-2.5 rounded-sm bg-heat-warm" /> page de tarifs
                  </span>
                }
              >
                Temps passé par page
              </SectionTitle>
              <Surface className="p-4">
                <PageTimeChart data={chartData} />
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

          {testToolsEnabled() && <LinkTestTools linkId={link.id} />}

          <section>
            <SectionTitle>Activité</SectionTitle>
            <div className="pl-3">
              <ActivityTimeline items={timeline} />
            </div>
          </section>
        </div>

        <aside className="space-y-10">
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

          <section>
            <SectionTitle hint="vous seul le voyez">Le deal</SectionTitle>
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
                    ].join("|"),
                    dealAmount: link.dealAmountCents !== null ? String(link.dealAmountCents / 100) : "",
                    dealCurrency: link.dealCurrency ?? "EUR",
                    decisionDeadline: link.decisionDeadline?.toISOString().slice(0, 10) ?? "",
                    decisionMakerName: link.decisionMakerName ?? "",
                    decisionMakerRole: link.decisionMakerRole ?? "",
                    sellerNotes: link.sellerNotes ?? "",
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
    </div>
  );
}
