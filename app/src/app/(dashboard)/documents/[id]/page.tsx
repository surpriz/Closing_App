import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CopyButton } from "@/components/dashboard/copy-button";
import { NewLinkDialog } from "@/components/dashboard/create-link-form";
import { DeleteDocumentButton } from "@/components/dashboard/delete-document-button";
import { DocumentPreview } from "@/components/dashboard/document-preview";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EngineDevTools } from "@/components/dashboard/engine-dev-tools";
import { FollowupsPanel, type FollowupItem } from "@/components/dashboard/followups-panel";
import { HeatBar } from "@/components/dashboard/heat";
import {
  ALERT_CHANNEL_LABELS,
  ALERT_TYPE_LABELS,
  DEAL_STATUS_LABELS,
  TAG_LABELS,
  TIER_LABELS,
} from "@/components/dashboard/labels";
import { LinkFollowupsToggle } from "@/components/dashboard/link-followups-toggle";
import { PageHeader, SectionTitle, StatLine, Surface } from "@/components/dashboard/page-header";
import { PageTimeChart, type PageTimeDatum } from "@/components/dashboard/page-time-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAppOrigin } from "@/lib/app-origin";
import { getDocumentAnalytics } from "@/lib/closing/analytics";
import { prisma } from "@/lib/db";
import { formatBytes, formatDate, formatDuration, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { organization } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id, organizationId: organization.id },
    select: { name: true },
  });
  return { title: document?.name ?? "Devis" };
}

export default async function DocumentDetailPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const { organization } = await requireWorkspace();

  const document = await prisma.document.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      pages: { select: { pageNumber: true, tags: true }, orderBy: { pageNumber: "asc" } },
      links: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          prospects: { select: { email: true, name: true, company: true }, take: 1 },
          engagementScore: true,
          _count: { select: { views: true } },
        },
      },
    },
  });
  if (!document) notFound();

  const [analytics, origin, followups, alerts] = await Promise.all([
    getDocumentAnalytics(document.id),
    getAppOrigin(),
    prisma.followup.findMany({
      where: { link: { documentId: document.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        prospect: { select: { email: true, name: true } },
        link: { select: { name: true, slug: true } },
      },
    }),
    prisma.sellerAlert.findMany({
      where: { link: { documentId: document.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { link: { select: { name: true, slug: true } } },
    }),
  ]);

  const statsByPage = new Map(analytics.pages.map((p) => [p.pageNumber, p]));
  const chartData: PageTimeDatum[] = document.pages.map((page) => {
    const stat = statsByPage.get(page.pageNumber);
    const total = stat?.totalDurationMs ?? 0;
    return {
      pageNumber: page.pageNumber,
      totalSeconds: Math.round(total / 1000),
      avgSeconds: stat?.viewCount ? Math.round(total / stat.viewCount / 1000) : 0,
      isPricing: page.tags.includes("PRICING"),
    };
  });
  const taggedPages = document.pages.filter((p) => p.tags.length > 0);

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
    linkName: f.link.name ?? f.link.slug,
  }));

  const now = new Date();
  const ready = document.status === "READY";
  const pendingFollowups = followups.filter((f) => ["PENDING", "GENERATED", "SCHEDULED"].includes(f.status)).length;

  return (
    <div className="space-y-8">
      {document.status === "PROCESSING" && <AutoRefresh intervalMs={2000} />}

      <div className="space-y-4">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Devis
        </Link>
        <PageHeader
          title={document.name}
          description={
            document.status === "FAILED" ? (
              <span className="text-destructive">
                L&apos;analyse a échoué : {document.processingError ?? "erreur inconnue"}
              </span>
            ) : ready ? (
              [
                document.numPages ? `${document.numPages} pages` : null,
                formatBytes(document.sizeBytes),
                `importé le ${formatDate(document.createdAt)}`,
              ]
                .filter(Boolean)
                .join(", ")
            ) : (
              "Analyse du devis en cours, quelques secondes…"
            )
          }
          action={
            <div className="flex items-center gap-2">
              <NewLinkDialog documentId={document.id} disabled={!ready} />
              <DeleteDocumentButton documentId={document.id} linkCount={document.links.length} />
            </div>
          }
        />
        {analytics.viewCount > 0 && (
          <StatLine
            items={[
              { value: analytics.viewCount, label: analytics.viewCount === 1 ? "lecture" : "lectures" },
              {
                value: analytics.uniqueVisitors,
                label: analytics.uniqueVisitors === 1 ? "lecteur" : "lecteurs différents",
              },
              { value: formatDuration(analytics.totalDurationMs), label: "de lecture au total" },
              ...(analytics.lastActivityAt
                ? [{ value: formatRelative(analytics.lastActivityAt, now), label: "lu", labelFirst: true }]
                : []),
            ]}
          />
        )}
      </div>

      <Tabs defaultValue="prospects" className="gap-6">
        <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border pb-px">
          <TabsTrigger value="prospects" className="flex-none px-0 text-[15px]">
            Prospects <span className="text-muted-foreground tabular-nums">{document.links.length}</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-none px-0 text-[15px]">
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="reading" className="flex-none px-0 text-[15px]">
            Lecture
          </TabsTrigger>
          <TabsTrigger value="followups" className="flex-none px-0 text-[15px]">
            Relances
            {pendingFollowups > 0 && <span className="text-muted-foreground tabular-nums">{pendingFollowups}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prospects">
          {document.links.length === 0 ? (
            <EmptyState
              title="Créez un lien pour chaque prospect."
              description="Envoyez-le à la place du PDF. Vous verrez qui l'ouvre, combien de temps il lit, et Clozer relancera pour vous."
              action={<NewLinkDialog documentId={document.id} disabled={!ready} variant="outline" />}
            />
          ) : (
            <Surface>
              <ul className="divide-y divide-border">
                {document.links.map((link) => {
                  const prospect = link.prospects[0];
                  const url = `${origin}/v/${link.slug}`;
                  const score = link.engagementScore;
                  const state =
                    link.dealStatus !== "OPEN"
                      ? DEAL_STATUS_LABELS[link.dealStatus]
                      : score
                        ? TIER_LABELS[score.tier]
                        : "Pas encore ouvert";
                  return (
                    <li
                      key={link.id}
                      className="relative flex items-stretch gap-4 py-3.5 pr-3 pl-4 transition-colors hover:bg-muted/50"
                    >
                      <HeatBar tier={score?.tier ?? null} score={score?.score ?? 0} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/links/${link.id}`}
                          className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                        >
                          {prospect?.company ?? link.name ?? prospect?.name ?? prospect?.email ?? "Sans nom"}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground">
                          {[prospect?.company ? prospect.name : null, prospect?.email].filter(Boolean).join(", ") ||
                            `Créé ${formatRelative(link.createdAt, now)}`}
                        </p>
                        <p className="mt-0.5 text-sm sm:hidden">
                          {state}
                          <span className="text-muted-foreground">
                            , {link._count.views} {link._count.views === 1 ? "lecture" : "lectures"}
                          </span>
                        </p>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end justify-center text-sm sm:flex">
                        <span className={score || link.dealStatus !== "OPEN" ? "" : "text-muted-foreground"}>
                          {state}
                        </span>
                        <span className="text-muted-foreground">
                          {link._count.views} {link._count.views === 1 ? "lecture" : "lectures"}
                        </span>
                      </div>
                      <div className="relative z-10 flex items-center gap-3 pl-2">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="hidden md:inline">Relances</span>
                          <LinkFollowupsToggle linkId={link.id} enabled={link.followupsEnabled} />
                        </label>
                        <CopyButton value={url} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Surface>
          )}
        </TabsContent>

        <TabsContent value="preview">
          {ready ? (
            <DocumentPreview fileUrl={`/api/documents/${document.id}/file`} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              L&apos;aperçu s&apos;affichera une fois l&apos;analyse terminée.
            </p>
          )}
        </TabsContent>

        <TabsContent value="reading" className="space-y-10">
          <section>
            <SectionTitle
              hint="toutes lectures confondues"
              action={
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="size-2.5 rounded-sm bg-heat-warm" /> page de tarifs
                </span>
              }
            >
              Temps passé par page
            </SectionTitle>
            <Surface className="p-4">
              {chartData.length > 0 ? (
                <PageTimeChart data={chartData} />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {ready ? "Aucune page détectée." : "Analyse du devis en cours…"}
                </p>
              )}
            </Surface>
            {taggedPages.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Repéré automatiquement :{" "}
                {taggedPages
                  .map((page) => `page ${page.pageNumber} (${page.tags.map((t) => TAG_LABELS[t].toLowerCase()).join(", ")})`)
                  .join(", ")}
              </p>
            )}
          </section>

          <section>
            <SectionTitle>Dernières lectures</SectionTitle>
            {analytics.recentViews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Personne n&apos;a encore ouvert ce devis. Les lectures s&apos;afficheront ici.
              </p>
            ) : (
              <Surface>
                <ul className="divide-y divide-border">
                  {analytics.recentViews.map((view) => (
                    <li key={view.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {view.prospect?.name ?? view.email ?? "Lecteur anonyme"}
                          <span className="font-normal text-muted-foreground">, {view.link.name ?? view.link.slug}</span>
                        </p>
                        <p className="truncate text-muted-foreground">
                          {[
                            [view.city, view.country].filter(Boolean).join(", ") || null,
                            view.timezone,
                            [view.deviceType, view.browser].filter(Boolean).join(" ") || null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums">{formatDuration(view.totalDurationMs)}</p>
                        <p className="text-muted-foreground" title={formatDate(view.lastSeenAt)}>
                          {formatRelative(view.lastSeenAt, now)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </section>
        </TabsContent>

        <TabsContent value="followups" className="space-y-10">
          <section className="space-y-4">
            <p className="max-w-2xl text-[15px] text-muted-foreground">
              Clozer prépare une relance quand un prospect lit longtemps vos tarifs sans répondre, ou
              n&apos;ouvre pas son lien. Elle part aux heures de bureau du prospect, et vous pouvez la lire,
              l&apos;envoyer tout de suite ou l&apos;annuler avant.
            </p>
            {process.env.NODE_ENV === "development" && (
              <EngineDevTools links={document.links.map((l) => ({ id: l.id, name: l.name ?? l.slug }))} />
            )}
            <Surface className="p-4">
              <FollowupsPanel followups={followupItems} showLink />
            </Surface>
          </section>

          {alerts.length > 0 && (
            <section>
              <SectionTitle>Alertes</SectionTitle>
              <Surface>
                <ul className="divide-y divide-border">
                  {alerts.map((alert) => {
                    const payload = alert.payload as { liveViewers?: number; inactiveDays?: number };
                    return (
                      <li key={alert.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium">
                            {ALERT_TYPE_LABELS[alert.type]}
                            <span className="font-normal text-muted-foreground">
                              , {alert.link.name ?? alert.link.slug}
                              {payload.liveViewers ? `, ${payload.liveViewers} lecteurs en même temps` : ""}
                              {payload.inactiveDays ? `, après ${payload.inactiveDays} jours` : ""}
                            </span>
                          </p>
                          <p className="text-muted-foreground">
                            {alert.sentAt ? "Envoyée" : "Non envoyée"} par{" "}
                            {alert.channels.map((c) => ALERT_CHANNEL_LABELS[c].toLowerCase()).join(", ")}
                          </p>
                          {alert.error && <p className="text-destructive">{alert.error}</p>}
                        </div>
                        <span className="shrink-0 text-muted-foreground">{formatRelative(alert.createdAt, now)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Surface>
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
