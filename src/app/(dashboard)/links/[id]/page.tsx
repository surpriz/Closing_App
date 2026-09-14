import { ArrowLeft, Clock, Eye, History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline, type TimelineItem } from "@/components/dashboard/activity-timeline";
import { ArchiveLinkButton } from "@/components/dashboard/archive-link-button";
import { CopyButton } from "@/components/dashboard/copy-button";
import { DealStatusSelect } from "@/components/dashboard/deal-status-select";
import { EngagementBadge } from "@/components/dashboard/engagement-badge";
import { FollowupsPanel, type FollowupItem } from "@/components/dashboard/followups-panel";
import {
  ALERT_TYPE_LABELS,
  CHANNEL_LABELS,
  FOLLOWUP_TRIGGER_LABELS,
  SCORE_REASON_LABELS,
} from "@/components/dashboard/labels";
import { LinkSettingsForm } from "@/components/dashboard/link-settings-form";
import { PageTimeChart, type PageTimeDatum } from "@/components/dashboard/page-time-chart";
import { ProspectForm } from "@/components/dashboard/prospect-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAppOrigin } from "@/lib/app-origin";
import { getLinkAnalytics } from "@/lib/closing/analytics";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import type { EngagementReason } from "@/lib/closing/types";
import { prisma } from "@/lib/db";
import { formatDuration, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

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
          pages: { select: { pageNumber: true, tags: true }, orderBy: { pageNumber: "asc" } },
        },
      },
      prospects: { orderBy: { createdAt: "asc" } },
      engagementScore: true,
    },
  });
  if (!link) notFound();

  const [analytics, settings, origin, followups, alerts, actions] = await Promise.all([
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
  ]);

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
    };
  });

  const reasons = Array.isArray(link.engagementScore?.reasons)
    ? (link.engagementScore.reasons as unknown as EngagementReason[])
    : [];

  const timeline: TimelineItem[] = [
    { id: `created-${link.id}`, at: link.createdAt, kind: "created" as const, title: "Lien créé" },
    ...analytics.recentViews.map((view) => ({
      id: `view-${view.id}`,
      at: view.startedAt,
      kind: "view" as const,
      title: `Lecture · ${view.prospect?.name ?? view.email ?? "visiteur anonyme"}`,
      detail: [
        formatDuration(view.totalDurationMs),
        `jusqu'à la page ${view.maxPageReached}`,
        [view.deviceType, view.browser].filter(Boolean).join(" "),
        view.timezone,
      ]
        .filter(Boolean)
        .join(" · "),
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
        title: `Relance envoyée · ${FOLLOWUP_TRIGGER_LABELS[f.trigger]}`,
        detail: `${CHANNEL_LABELS[f.channel]} à ${f.prospect.name ?? f.prospect.email}`,
      })),
    ...alerts.map((alert) => {
      const payload = alert.payload as { liveViewers?: number; inactiveDays?: number };
      return {
        id: `alert-${alert.id}`,
        at: alert.createdAt,
        kind: "alert" as const,
        title: `Alerte · ${ALERT_TYPE_LABELS[alert.type]}`,
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

  const followupItems: FollowupItem[] = followups.map((f) => ({
    id: f.id,
    status: f.status,
    trigger: f.trigger,
    channel: f.channel,
    scheduledFor: f.scheduledFor,
    timezone: f.timezone,
    subject: f.subject,
    body: f.body,
    error: f.error,
    aiProvider: f.aiProvider,
    aiModel: f.aiModel,
    sentAt: f.sentAt,
    recipient: f.prospect.name ?? f.prospect.email,
    linkName: link.name ?? link.slug,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href={`/documents/${link.document.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {link.document.name}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">
                {url}
              </a>
              <CopyButton value={url} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DealStatusSelect linkId={link.id} status={link.dealStatus} />
            <ArchiveLinkButton linkId={link.id} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Intérêt</div>
            {link.engagementScore ? (
              <EngagementBadge
                tier={link.engagementScore.tier}
                score={link.engagementScore.score}
                reasons={link.engagementScore.reasons}
              />
            ) : (
              <div className="text-xl font-semibold">–</div>
            )}
          </CardContent>
        </Card>
        <Stat icon={<Eye className="size-4" />} label="Lectures" value={String(analytics.viewCount)} />
        <Stat icon={<Clock className="size-4" />} label="Temps de lecture" value={formatDuration(analytics.totalDurationMs)} />
        <Stat
          icon={<History className="size-4" />}
          label="Dernière lecture"
          value={analytics.lastActivityAt ? formatRelative(analytics.lastActivityAt) : "–"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Temps passé par page</CardTitle>
              <CardDescription>
                Pour ce prospect uniquement.{" "}
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-sm bg-amber-500" /> page tarifs
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PageTimeChart data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activité</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Relances</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowupsPanel followups={followupItems} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pourquoi ce score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reasons.length === 0 && <p className="text-muted-foreground">Pas encore de signal.</p>}
              {reasons.map((reason) => (
                <div key={reason.code} className="flex items-center justify-between gap-2">
                  <span>
                    {SCORE_REASON_LABELS[reason.code] ?? reason.code}
                    {reason.detail && <span className="text-muted-foreground"> · {reason.detail}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">+{reason.weight}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Destinataires des relances sur ce lien.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {link.prospects.map((prospect) => (
                <details key={prospect.id} className="rounded-lg border px-3 py-2">
                  <summary className="cursor-pointer select-none text-sm">
                    <span className="font-medium">{prospect.name ?? prospect.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {prospect.email}
                      {prospect.phoneE164 ? ` · ${prospect.phoneE164}` : ""}
                      {prospect.whatsappOptInAt ? " · WhatsApp ok" : ""}
                      {prospect.timezone ? ` · ${prospect.timezone}` : ""}
                    </span>
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
              <details className="rounded-lg border border-dashed px-3 py-2">
                <summary className="cursor-pointer select-none text-sm font-medium">Ajouter un contact</summary>
                <ProspectForm linkId={link.id} />
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Réglages du lien</CardTitle>
              <CardDescription>Champs vides : paramètres de l&apos;espace.</CardDescription>
            </CardHeader>
            <CardContent>
              <LinkSettingsForm
                linkId={link.id}
                initial={{
                  version: link.updatedAt.toISOString(),
                  name: link.name ?? "",
                  requireEmail: link.requireEmail,
                  ctaEnabled: link.ctaEnabled,
                  followupsEnabled: link.followupsEnabled,
                  channels: link.channels,
                  hotPricingThresholdSec: link.hotPricingThresholdSec,
                  inactivityDays: link.inactivityDays,
                  businessHourStart: link.businessHourStart,
                  businessHourEnd: link.businessHourEnd,
                }}
                defaults={{
                  channels: settings.defaultChannels,
                  hotPricingThresholdSec: settings.hotPricingThresholdSec,
                  inactivityDays: settings.inactivityDays,
                  businessHourStart: settings.businessHourStart,
                  businessHourEnd: settings.businessHourEnd,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
