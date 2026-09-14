import { BellRing, CalendarClock, CheckCircle2, Flame, MessageSquare, Send } from "lucide-react";
import Link from "next/link";

import { EngagementBadge } from "@/components/dashboard/engagement-badge";
import {
  ALERT_TYPE_LABELS,
  CHANNEL_LABELS,
  DEAL_STATUS_LABELS,
  FOLLOWUP_TRIGGER_LABELS,
} from "@/components/dashboard/labels";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { prisma } from "@/lib/db";
import { formatInTimeZone, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

const OPEN_FOLLOWUP_STATUSES = ["PENDING", "GENERATED", "SCHEDULED"] as const;

export default async function DashboardPage() {
  const { organization } = await requireWorkspace();
  const organizationId = organization.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeLinks = { organizationId, archivedAt: null };

  const [
    documentCount,
    activeCount,
    hotCount,
    plannedCount,
    validatedThisMonth,
    priorityLinks,
    prospectActions,
    alerts,
    upcomingFollowups,
  ] = await Promise.all([
    prisma.document.count({ where: { organizationId, archivedAt: null } }),
    prisma.link.count({ where: { ...activeLinks, dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] } } }),
    prisma.link.count({
      where: { ...activeLinks, dealStatus: "OPEN", engagementScore: { is: { tier: "HOT" } } },
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
    prisma.prospectAction.findMany({
      where: { link: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        link: { select: { id: true, name: true, document: { select: { name: true } } } },
        prospect: { select: { name: true, email: true } },
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
      take: 8,
      include: {
        link: { select: { id: true, name: true, slug: true } },
        prospect: { select: { name: true, email: true } },
      },
    }),
  ]);

  if (documentCount === 0) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-xl">Bienvenue</CardTitle>
          <CardDescription>
            Importez un premier devis, envoyez le lien à votre prospect et suivez ici qui est prêt à signer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/documents" className={buttonVariants({ size: "lg" })}>
            Importer un devis
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Qui lit vos propositions, et qui relancer maintenant.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Propositions en cours" value={activeCount} />
        <Kpi label="Leads chauds" value={hotCount} icon={<Flame className="size-4 text-red-600" />} />
        <Kpi label="Relances planifiées" value={plannedCount} icon={<CalendarClock className="size-4" />} />
        <Kpi
          label="Validées ce mois-ci"
          value={validatedThisMonth}
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>À traiter en priorité</CardTitle>
          <CardDescription>Propositions ouvertes classées par intérêt du prospect.</CardDescription>
        </CardHeader>
        <CardContent>
          {priorityLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune lecture pour l&apos;instant. Les prospects apparaîtront ici dès qu&apos;ils ouvrent leur lien.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Intérêt</TableHead>
                  <TableHead>Dernière lecture</TableHead>
                  <TableHead>Prochaine relance</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityLinks.map((link) => {
                  const prospect = link.prospects[0];
                  const next = link.followups[0];
                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <Link href={`/links/${link.id}`} className="font-medium hover:underline">
                          {prospect?.company ?? link.name ?? link.slug}
                        </Link>
                        {prospect && (
                          <div className="text-xs text-muted-foreground">{prospect.name ?? prospect.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{link.document.name}</TableCell>
                      <TableCell>
                        {link.engagementScore && (
                          <EngagementBadge
                            tier={link.engagementScore.tier}
                            score={link.engagementScore.score}
                            reasons={link.engagementScore.reasons}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {link.lastActivityAt ? formatRelative(link.lastActivityAt) : "–"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {next ? `${formatInTimeZone(next.scheduledFor, next.timezone)} · ${CHANNEL_LABELS[next.channel]}` : "–"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{DEAL_STATUS_LABELS[link.dealStatus]}</Badge>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-4" /> Réponses des prospects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {prospectActions.length === 0 && <p className="text-muted-foreground">Aucune réponse pour l&apos;instant.</p>}
            {prospectActions.map((action) => (
              <div key={action.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/links/${action.link.id}`} className="font-medium hover:underline">
                    {action.prospect?.name ?? action.prospect?.email ?? action.link.name ?? "Prospect"}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatRelative(action.createdAt)}</span>
                </div>
                <div className={action.type === "VALIDATE_SIGN" ? "text-emerald-700" : "text-amber-700"}>
                  {action.type === "VALIDATE_SIGN" ? "A validé la proposition" : "Demande un ajustement"}
                  <span className="text-muted-foreground"> · {action.link.document.name}</span>
                </div>
                {action.message && (
                  <p className="rounded-md bg-muted/60 px-2 py-1.5 text-muted-foreground">« {action.message} »</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4" /> Alertes hot lead
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {alerts.length === 0 && <p className="text-muted-foreground">Aucune alerte pour l&apos;instant.</p>}
            {alerts.map((alert) => {
              const payload = alert.payload as { liveViewers?: number; inactiveDays?: number };
              return (
                <div key={alert.id}>
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/links/${alert.link.id}`} className="font-medium hover:underline">
                      {alert.link.name ?? alert.link.slug}
                    </Link>
                    <span className="text-xs text-muted-foreground">{formatRelative(alert.createdAt)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {ALERT_TYPE_LABELS[alert.type]}
                    {payload.liveViewers ? ` · ${payload.liveViewers} lecteurs` : ""}
                    {payload.inactiveDays ? ` · après ${payload.inactiveDays} jours` : ""}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-4" /> Prochaines relances
            </CardTitle>
            <CardDescription>Heure locale du prospect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {upcomingFollowups.length === 0 && (
              <p className="text-muted-foreground">Aucune relance planifiée.</p>
            )}
            {upcomingFollowups.map((followup) => (
              <div key={followup.id}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/links/${followup.link.id}`} className="font-medium hover:underline">
                    {followup.prospect.name ?? followup.prospect.email}
                  </Link>
                  <span className="text-xs text-muted-foreground">{CHANNEL_LABELS[followup.channel]}</span>
                </div>
                <div className="text-muted-foreground">
                  {FOLLOWUP_TRIGGER_LABELS[followup.trigger]} · {formatInTimeZone(followup.scheduledFor, followup.timezone)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
