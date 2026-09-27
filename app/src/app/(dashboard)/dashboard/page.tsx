import { BellRing, Check, MessageSquare, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CopyButton } from "@/components/dashboard/copy-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { HeatBar } from "@/components/dashboard/heat";
import {
  ALERT_TYPE_LABELS,
  CHANNEL_LABELS,
  DEAL_STATUS_LABELS,
  TIER_LABELS,
} from "@/components/dashboard/labels";
import { SectionTitle } from "@/components/dashboard/page-header";
import { buildTodayHeadline } from "@/components/dashboard/today-headline";
import { buttonVariants } from "@/components/ui/button";
import { getAppOrigin } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { formatDate, formatInTimeZone, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Aujourd'hui" };

const OPEN_FOLLOWUP_STATUSES = ["PENDING", "GENERATED", "SCHEDULED"] as const;
const DAY = 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const { organization } = await requireWorkspace();
  const organizationId = organization.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeLinks = { organizationId, archivedAt: null };

  const [
    documentCount,
    activeCount,
    unopenedCount,
    warmCount,
    plannedCount,
    validatedThisMonth,
    priorityLinks,
    unopenedLinks,
    changeRequested,
    prospectActions,
    alerts,
    upcomingFollowups,
    origin,
  ] = await Promise.all([
    prisma.document.count({ where: { organizationId, archivedAt: null } }),
    prisma.link.count({ where: { ...activeLinks, dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] } } }),
    prisma.link.count({ where: { ...activeLinks, dealStatus: "OPEN", lastActivityAt: null } }),
    prisma.link.count({
      where: { ...activeLinks, dealStatus: "OPEN", engagementScore: { is: { tier: "WARM" } } },
    }),
    prisma.followup.count({
      where: { link: activeLinks, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
    }),
    prisma.prospectAction.count({
      where: { link: { organizationId }, type: "VALIDATE_SIGN", createdAt: { gte: monthStart } },
    }),
    prisma.link.findMany({
      where: {
        ...activeLinks,
        dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] },
        engagementScore: { isNot: null },
      },
      orderBy: { engagementScore: { score: "desc" } },
      take: 10,
      include: {
        engagementScore: true,
        document: { select: { name: true } },
        prospects: { orderBy: { createdAt: "asc" }, take: 1 },
        followups: {
          where: { status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
          orderBy: { scheduledFor: "asc" },
          take: 1,
        },
      },
    }),
    prisma.link.findMany({
      where: { ...activeLinks, dealStatus: "OPEN", lastActivityAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        document: { select: { name: true } },
        prospects: { orderBy: { createdAt: "asc" }, take: 1 },
        followups: {
          where: { status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
          orderBy: { scheduledFor: "asc" },
          take: 1,
        },
      },
    }),
    prisma.link.findMany({
      where: { ...activeLinks, dealStatus: "CHANGE_REQUESTED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { name: true, slug: true, prospects: { orderBy: { createdAt: "asc" }, take: 1 } },
    }),
    prisma.prospectAction.findMany({
      where: { link: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        link: {
          select: {
            id: true,
            name: true,
            slug: true,
            document: { select: { name: true } },
            prospects: { orderBy: { createdAt: "asc" }, take: 1 },
          },
        },
        prospect: { select: { name: true, email: true, company: true } },
      },
    }),
    prisma.sellerAlert.findMany({
      where: { link: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { link: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.followup.findMany({
      where: { link: activeLinks, status: { in: ["GENERATED", "SCHEDULED"] } },
      orderBy: { scheduledFor: "asc" },
      take: 4,
      include: {
        link: { select: { id: true, name: true, slug: true } },
        prospect: { select: { name: true, email: true, company: true } },
      },
    }),
    getAppOrigin(),
  ]);

  if (documentCount === 0) {
    return (
      <div className="space-y-8">
        <h1 className="max-w-2xl text-[2.25rem] leading-[1.1] font-medium tracking-[-0.03em] [font-stretch:88%]">
          Bienvenue sur Clozer.
        </h1>
        <EmptyState
          title="Importez votre premier devis."
          description="Vous créerez ensuite un lien par prospect, et vous verrez ici qui le lit et qui relancer."
          action={
            <Link href="/documents" className={buttonVariants({ size: "lg" })}>
              Importer un devis
            </Link>
          }
        />
      </div>
    );
  }

  const { headline, hint } = buildTodayHeadline({
    hotProspects: priorityLinks
      .filter((link) => link.dealStatus === "OPEN" && link.engagementScore?.tier === "HOT")
      .map((link) => prospectName(link)),
    warmCount,
    changeRequests: changeRequested.map((link) => prospectName(link)),
    freshValidations: prospectActions
      .filter((action) => action.type === "VALIDATE_SIGN" && now.getTime() - action.createdAt.getTime() < DAY)
      .map((action) => action.prospect?.company ?? prospectName(action.link)),
    activeCount,
    unopenedCount,
    nextFollowupLabel: upcomingFollowups[0] ? formatRelative(upcomingFollowups[0].scheduledFor, now) : null,
  });

  const rows = [
    ...priorityLinks.map((link) => ({ ...link, score: link.engagementScore })),
    ...unopenedLinks.map((link) => ({ ...link, score: null })),
  ];

  const feed = [
    ...prospectActions.map((action) => ({
      id: action.id,
      at: action.createdAt,
      linkId: action.link.id,
      who: action.prospect?.company ?? action.prospect?.name ?? prospectName(action.link),
      icon: action.type === "VALIDATE_SIGN" ? <Check /> : <MessageSquare />,
      strong: action.type === "VALIDATE_SIGN",
      what:
        action.type === "VALIDATE_SIGN"
          ? `a validé ${action.link.document.name}`
          : `demande un ajustement sur ${action.link.document.name}`,
      quote: action.message,
    })),
    ...alerts.map((alert) => {
      const payload = alert.payload as { liveViewers?: number; inactiveDays?: number };
      return {
        id: alert.id,
        at: alert.createdAt,
        linkId: alert.link.id,
        who: alert.link.name ?? alert.link.slug,
        icon: <BellRing className="text-heat-hot" />,
        strong: false,
        what:
          alert.type === "MULTI_VIEWER" && payload.liveViewers
            ? `est lu par ${payload.liveViewers} personnes en même temps`
            : alert.type === "REOPENED_AFTER_INACTIVITY" && payload.inactiveDays
              ? `a été rouvert après ${payload.inactiveDays} jours de silence`
              : ALERT_TYPE_LABELS[alert.type].toLowerCase(),
        quote: null,
      };
    }),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <h1 className="max-w-3xl text-[1.875rem] leading-[1.12] font-medium tracking-[-0.03em] text-balance [font-stretch:88%] sm:text-[2.25rem]">
          {headline}
          <span className="block text-muted-foreground">{hint}</span>
        </h1>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Stat value={activeCount} label={activeCount === 1 ? "prospect en cours" : "prospects en cours"} />
          <Stat value={plannedCount} label={plannedCount === 1 ? "relance prévue" : "relances prévues"} />
          <Stat value={validatedThisMonth} label={validatedThisMonth === 1 ? "validé ce mois" : "validés ce mois"} />
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <SectionTitle hint="du plus chaud au plus froid">À traiter</SectionTitle>
          {rows.length === 0 ? (
            <EmptyState
              title="Aucun lien prospect pour l'instant."
              description="Ouvrez un devis et créez un lien par prospect. Chacun apparaîtra ici, classé par température."
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
              {rows.map((link) => {
                const prospect = link.prospects[0];
                const next = link.followups[0];
                const score = link.score;
                const state =
                  link.dealStatus !== "OPEN"
                    ? DEAL_STATUS_LABELS[link.dealStatus]
                    : score
                      ? TIER_LABELS[score.tier]
                      : "Pas encore ouvert";
                const read = link.lastActivityAt ? `, lu ${formatRelative(link.lastActivityAt, now)}` : "";
                return (
                  <li
                    key={link.id}
                    className="group relative flex items-stretch gap-4 py-3.5 pr-3 pl-4 transition-colors hover:bg-muted/50"
                  >
                    <HeatBar tier={score?.tier ?? null} score={score?.score ?? 0} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/links/${link.id}`}
                        className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                      >
                        {prospectName(link)}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {[prospect?.company && (prospect.name ?? prospect.email), link.document.name]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="mt-0.5 text-sm sm:hidden">
                        {state}
                        <span className="text-muted-foreground">{read}</span>
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-col items-end justify-center text-sm sm:flex">
                      <span className={score || link.dealStatus !== "OPEN" ? "" : "text-muted-foreground"}>
                        {state}
                        <span className="text-muted-foreground">{read}</span>
                      </span>
                      {next && (
                        <span
                          className="text-muted-foreground"
                          title={`${formatInTimeZone(next.scheduledFor, next.timezone)}, heure du prospect`}
                        >
                          Relance {CHANNEL_LABELS[next.channel].toLowerCase()} {formatRelative(next.scheduledFor, now)}
                        </span>
                      )}
                    </div>
                    <div className="relative z-10 flex items-center">
                      <CopyButton value={`${origin}/v/${link.slug}`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-10">
          <section>
            <SectionTitle>Ce qui s&apos;est passé</SectionTitle>
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Les réponses de vos prospects et les alertes s&apos;afficheront ici.
              </p>
            ) : (
              <ol className="space-y-4">
                {feed.map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border [&_svg]:size-3.5">
                      {item.icon}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p>
                        <Link href={`/links/${item.linkId}`} className="font-medium hover:underline">
                          {item.who}
                        </Link>{" "}
                        <span className={item.strong ? "" : "text-muted-foreground"}>{item.what}</span>
                      </p>
                      {item.quote && (
                        <p className="border-l-2 border-border pl-2.5 text-pretty text-muted-foreground">{item.quote}</p>
                      )}
                      <time className="block text-xs text-muted-foreground" title={formatDate(item.at)}>
                        {formatRelative(item.at, now)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
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

function prospectName(link: {
  name: string | null;
  slug: string;
  prospects: { company: string | null; name: string | null; email: string | null }[];
}) {
  const prospect = link.prospects[0];
  return prospect?.company ?? link.name ?? prospect?.name ?? prospect?.email ?? link.slug;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}
