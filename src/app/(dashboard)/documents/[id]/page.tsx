import { ArrowLeft, BellRing, Clock, Eye, History, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CopyButton } from "@/components/dashboard/copy-button";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { DocumentStatusBadge } from "@/components/dashboard/document-status-badge";
import { EngagementBadge } from "@/components/dashboard/engagement-badge";
import { EngineDevTools } from "@/components/dashboard/engine-dev-tools";
import { FollowupsPanel, type FollowupItem } from "@/components/dashboard/followups-panel";
import {
  ALERT_CHANNEL_LABELS,
  ALERT_TYPE_LABELS,
  DEAL_STATUS_LABELS,
  TAG_LABELS,
} from "@/components/dashboard/labels";
import { LinkFollowupsToggle } from "@/components/dashboard/link-followups-toggle";
import { PageTimeChart, type PageTimeDatum } from "@/components/dashboard/page-time-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAppOrigin } from "@/lib/app-origin";
import { getDocumentAnalytics } from "@/lib/closing/analytics";
import { prisma } from "@/lib/db";
import { formatBytes, formatDate, formatDuration, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

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

  return (
    <div className="space-y-6">
      {document.status === "PROCESSING" && <AutoRefresh intervalMs={2000} />}

      <div className="space-y-2">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Documents
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{document.name}</h1>
          <DocumentStatusBadge status={document.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {document.numPages ? `${document.numPages} pages · ` : ""}
          {formatBytes(document.sizeBytes)} · importé le {formatDate(document.createdAt)}
        </p>
        {document.status === "FAILED" && (
          <p className="text-sm text-destructive">
            L&apos;analyse a échoué : {document.processingError ?? "erreur inconnue"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Eye className="size-4" />} label="Vues" value={String(analytics.viewCount)} />
        <StatCard
          icon={<Users className="size-4" />}
          label="Visiteurs uniques"
          value={String(analytics.uniqueVisitors)}
        />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Temps de lecture"
          value={formatDuration(analytics.totalDurationMs)}
        />
        <StatCard
          icon={<History className="size-4" />}
          label="Dernière lecture"
          value={analytics.lastActivityAt ? formatRelative(analytics.lastActivityAt) : "–"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Temps passé par page</CardTitle>
            <CardDescription>
              Cumul de toutes les lectures.{" "}
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-sm bg-amber-500" /> page tarifs détectée
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <PageTimeChart data={chartData} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {document.status === "READY" ? "Aucune page détectée." : "Analyse du document en cours…"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pages repérées</CardTitle>
            <CardDescription>Détection automatique par mots-clés</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {taggedPages.length === 0 && (
              <p className="text-muted-foreground">Aucune page particulière repérée.</p>
            )}
            {taggedPages.map((page) => (
              <div key={page.pageNumber} className="flex items-center justify-between gap-2">
                <span>Page {page.pageNumber}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {page.tags.map((tag) => (
                    <Badge key={tag} variant={tag === "PRICING" ? "default" : "outline"}>
                      {TAG_LABELS[tag]}
                    </Badge>
                  ))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liens prospects</CardTitle>
          <CardDescription>Un lien par prospect pour savoir précisément qui lit quoi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CreateLinkForm documentId={document.id} disabled={document.status !== "READY"} />

          {document.links.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Lien</TableHead>
                  <TableHead>Intérêt</TableHead>
                  <TableHead className="text-right">Vues</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Relances</TableHead>
                  <TableHead className="text-right">Créé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {document.links.map((link) => {
                  const prospect = link.prospects[0];
                  const url = `${origin}/v/${link.slug}`;
                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="font-medium">{link.name ?? "Sans nom"}</div>
                        {prospect && (
                          <div className="text-xs text-muted-foreground">
                            {[prospect.name, prospect.email].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-40 truncate font-mono text-xs hover:underline"
                          >
                            /v/{link.slug}
                          </a>
                          <CopyButton value={url} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {link.engagementScore ? (
                          <EngagementBadge
                            tier={link.engagementScore.tier}
                            score={link.engagementScore.score}
                            reasons={link.engagementScore.reasons}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{link._count.views}</TableCell>
                      <TableCell>
                        <Badge variant={link.dealStatus === "VALIDATED" ? "default" : "outline"}>
                          {DEAL_STATUS_LABELS[link.dealStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <LinkFollowupsToggle linkId={link.id} enabled={link.followupsEnabled} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatRelative(link.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Relances</CardTitle>
            <CardDescription>
              Créées automatiquement : à chaud après une longue lecture des tarifs, ou si le lien n&apos;est
              jamais ouvert. Envoyées aux heures ouvrées du prospect.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === "development" && (
              <EngineDevTools
                links={document.links.map((l) => ({ id: l.id, name: l.name ?? l.slug }))}
              />
            )}
            <FollowupsPanel followups={followupItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4" /> Alertes hot lead
            </CardTitle>
            <CardDescription>Lecture à plusieurs ou retour après plusieurs jours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {alerts.length === 0 && <p className="text-muted-foreground">Aucune alerte pour l&apos;instant.</p>}
            {alerts.map((alert) => {
              const payload = alert.payload as { liveViewers?: number; inactiveDays?: number };
              return (
                <div key={alert.id} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{ALERT_TYPE_LABELS[alert.type]}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(alert.createdAt)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {alert.link.name ?? alert.link.slug}
                    {payload.liveViewers ? ` · ${payload.liveViewers} lecteurs simultanés` : ""}
                    {payload.inactiveDays ? ` · après ${payload.inactiveDays} jours` : ""}
                  </div>
                  <div className="text-xs">
                    {alert.sentAt ? "Envoyée" : "Non envoyée"} via{" "}
                    {alert.channels.map((c) => ALERT_CHANNEL_LABELS[c]).join(", ")}
                    {alert.error && <span className="block text-destructive">{alert.error}</span>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dernières lectures</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.recentViews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas encore de lecture. Ouvrez un lien prospect pour tester.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lecteur</TableHead>
                    <TableHead>Lien</TableHead>
                    <TableHead>Appareil</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead className="text-right">Dernière activité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.recentViews.map((view) => (
                    <TableRow key={view.id}>
                      <TableCell>
                        <div className="font-medium">
                          {view.prospect?.name ?? view.email ?? "Visiteur anonyme"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[view.city, view.country].filter(Boolean).join(", ") || "Localisation inconnue"}
                          {view.timezone ? ` · ${view.timezone}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{view.link.name ?? view.link.slug}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[view.deviceType, view.browser, view.os].filter(Boolean).join(" · ")}
                      </TableCell>
                      <TableCell className="text-right">{formatDuration(view.totalDurationMs)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatRelative(view.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zones & fuseaux horaires</CardTitle>
            <CardDescription>Géolocalisation IP (disponible une fois déployé)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {analytics.locations.length === 0 && (
              <p className="text-muted-foreground">Aucune donnée pour l&apos;instant.</p>
            )}
            {analytics.locations.map((location, index) => (
              <div key={index} className="flex items-center justify-between gap-2">
                <div>
                  <div>{[location.city, location.country].filter(Boolean).join(", ") || "Inconnue"}</div>
                  <div className="text-xs text-muted-foreground">{location.timezone ?? "Fuseau inconnu"}</div>
                </div>
                <span className="text-muted-foreground">{location.viewCount}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
