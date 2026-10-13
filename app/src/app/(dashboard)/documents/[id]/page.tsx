import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { NewLinkButton } from "@/components/dashboard/create-link-form";
import { DeleteDocumentButton } from "@/components/dashboard/delete-document-button";
import {
  AssistantNotesForm,
  DocumentPages,
  DocumentTypeSelect,
  SellerDescriptionForm,
  WebPageReading,
} from "@/components/dashboard/document-content";
import { DocumentAlerts } from "@/components/dashboard/document/document-alerts";
import {
  DocumentLinks,
  type ProspectLinkRow,
} from "@/components/dashboard/document/document-links";
import { DocumentPreviewSection } from "@/components/dashboard/document/document-preview-section";
import { ReadingFields } from "@/components/dashboard/document/reading-fields";
import { ReportStrip } from "@/components/dashboard/document/reading-bits";
import { RecentReads } from "@/components/dashboard/document/recent-reads";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  toFollowupItem,
  type FollowupItem,
} from "@/components/dashboard/followup-item";
import { FollowupsPanel } from "@/components/dashboard/followups-panel";
import { DEAL_STATUS_LABELS, TIER_LABELS } from "@/components/dashboard/labels";
import {
  PageHeader,
  SectionTitle,
  Surface,
} from "@/components/dashboard/page-header";
import {
  PageTimeChart,
  type PageTimeDatum,
} from "@/components/dashboard/page-time-chart";
import { WelcomeMessage } from "@/components/dashboard/welcome-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAppOrigin } from "@/lib/app-origin";
import { capsuleUploadPrefix } from "@/lib/blob";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { getDocumentAnalytics } from "@/lib/closing/analytics";
import { WELCOME_PAGE } from "@/lib/closing/capsules/resolve";
import { catchUpInBackground } from "@/lib/closing/catch-up";
import { buildDocumentFrictions } from "@/lib/closing/dashboard/frictions";
import { dealLabel, linkLabelSelect } from "@/lib/closing/dashboard/labels";
import { pageHeat } from "@/lib/closing/dashboard/page-heat";
import { getPageReadings } from "@/lib/closing/dashboard/queries";
import { showsReadingDetail } from "@/lib/closing/dashboard/reading-detail";
import { labelReaders } from "@/lib/closing/dashboard/readers";
import { tagLabels } from "@/lib/closing/documents/doc-types";
import {
  segmentLabel,
  VIDEO_SEGMENTS,
} from "@/lib/closing/documents/video-segments";
import { videoProvider } from "@/lib/closing/documents/web-link";
import { prisma } from "@/lib/db";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatRelative,
} from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { organization } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id, organizationId: organization.id },
    select: { name: true },
  });
  return { title: document?.name ?? "Document" };
}

export default async function DocumentDetailPage({
  params,
}: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const { organization, role } = await requireWorkspace();

  const document = await prisma.document.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      pages: {
        select: {
          pageNumber: true,
          tags: true,
          tagSource: true,
          summary: true,
          keyFacts: true,
        },
        orderBy: { pageNumber: "asc" },
      },
      // The document's own capsules; the ones recorded for one link live on its page
      capsules: {
        where: { linkId: null },
        select: {
          id: true,
          pageNumber: true,
          kind: true,
          hookText: true,
          durationMs: true,
          _count: { select: { plays: true } },
        },
      },
      links: {
        where: { archivedAt: null, draftAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          prospects: {
            select: { email: true, name: true, company: true },
            take: 1,
          },
          engagementScore: true,
          _count: { select: { views: true } },
        },
      },
    },
  });
  if (!document) notFound();
  catchUpInBackground({
    organizationId: organization.id,
    documentId: document.id,
  });

  const linkIds = document.links.map((link) => link.id);
  const [analytics, origin, followups, alerts, furthest, insights, readings] =
    await Promise.all([
      getDocumentAnalytics(document.id),
      getAppOrigin(),
      prisma.followup.findMany({
        where: { link: { documentId: document.id } },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          prospect: { select: { name: true, email: true } },
          link: { select: linkLabelSelect },
        },
      }),
      prisma.sellerAlert.findMany({
        where: {
          link: { documentId: document.id },
          type: {
            notIn: [
              "PROSPECT_VALIDATED",
              "CHANGE_REQUESTED",
              "QUOTE_REQUESTED",
              "MEETING_BOOKED",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { link: { select: linkLabelSelect } },
      }),
      prisma.documentView.groupBy({
        by: ["linkId"],
        where: { linkId: { in: linkIds }, isBot: false },
        _max: { maxPageReached: true },
      }),
      prisma.dealInsight.findMany({
        where: { linkId: { in: linkIds }, model: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: { linkId: true, frictions: true },
      }),
      getPageReadings(linkIds),
    ]);

  // The latest analysis of each deal only
  const latestFrictions = new Map<string, string[]>();
  for (const insight of insights) {
    if (latestFrictions.has(insight.linkId)) continue;
    latestFrictions.set(
      insight.linkId,
      (insight.frictions as { kind: string }[]).map((f) => f.kind),
    );
  }
  const furthestByLink = new Map(
    furthest.map((row) => [row.linkId, row._max.maxPageReached]),
  );
  const frictions = buildDocumentFrictions({
    numPages: document.kind !== "URL" ? document.pages.length : 0,
    pages: document.pages,
    deals: linkIds.map((id) => ({
      furthestPage: furthestByLink.get(id) ?? null,
    })),
    aiFrictions: [...latestFrictions.values()],
  });

  const statsByPage = new Map(analytics.pages.map((p) => [p.pageNumber, p]));
  const chartData: PageTimeDatum[] = document.pages.map((page) => {
    const stat = statsByPage.get(page.pageNumber);
    const total = stat?.totalDurationMs ?? 0;
    return {
      pageNumber: page.pageNumber,
      totalSeconds: Math.round(total / 1000),
      avgSeconds: stat?.viewCount
        ? Math.round(total / stat.viewCount / 1000)
        : 0,
      isPricing: page.tags.includes("PRICING"),
      summary: page.summary,
    };
  });
  const taggedPages = document.pages.filter((p) => p.tags.length > 0);
  const showsDetail = showsReadingDetail({
    kind: document.kind,
    durationMs: document.durationMs,
    viewCount: analytics.viewCount,
    pagesWithTime: chartData.filter((page) => page.totalSeconds > 0).length,
  });

  const followupItems: FollowupItem[] = followups.map((f) =>
    toFollowupItem(f, dealLabel(f.link)),
  );

  const now = new Date();
  const readerLabels = labelReaders(analytics.recentViews);
  const anonymousReaders = [...readerLabels.values()].some(
    (label) => !label.identified,
  );
  const ready = document.status === "READY";
  const welcome = document.capsules.find(
    (capsule) => capsule.pageNumber === WELCOME_PAGE,
  );
  const isWeb = document.kind === "URL";
  const isVideo = document.kind === "VIDEO";
  const pageName = (n: number) =>
    isVideo ? `passage ${segmentLabel(n)}` : `page ${n}`;
  const webHost = document.externalUrl
    ? new URL(document.externalUrl).hostname.replace(/^www\./, "")
    : null;
  const pendingFollowups = followups.filter((f) =>
    ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"].includes(f.status),
  ).length;

  // Pages heat per document and per link; a web page is one reading, nothing to strip
  const heatPages = isVideo ? VIDEO_SEGMENTS : document.numPages;
  const documentHeat =
    !isWeb && analytics.pages.some((p) => p.totalDurationMs > 0)
      ? pageHeat(
          analytics.pages.map((p) => ({
            pageNumber: p.pageNumber,
            durationMs: p.totalDurationMs,
          })),
          heatPages,
        )
      : null;

  const prospectRows: ProspectLinkRow[] = document.links.map((link) => {
    const prospect = link.prospects[0];
    const score = link.engagementScore;
    const expired = !!link.expiresAt && link.expiresAt <= now;
    const pages = readings.get(link.id);
    return {
      id: link.id,
      label: dealLabel({ ...link, document }),
      contact:
        [prospect?.company ? prospect.name : null, prospect?.email]
          .filter(Boolean)
          .join(" · ") || `Créé ${formatRelative(link.createdAt, now)}`,
      state: link.shared
        ? "Lien partagé"
        : link.dealStatus !== "OPEN"
          ? DEAL_STATUS_LABELS[link.dealStatus]
          : expired
            ? "Expiré"
            : score
              ? TIER_LABELS[score.tier]
              : "Pas encore ouvert",
      // The swatch shows a temperature only when the state is one
      tier:
        !link.shared && link.dealStatus === "OPEN" && !expired
          ? (score?.tier ?? null)
          : null,
      signed: link.dealStatus === "VALIDATED" || link.dealStatus === "WON",
      strong: !!score || link.dealStatus !== "OPEN",
      views: link._count.views,
      heat: pages && pages.length > 0 ? pageHeat(pages, heatPages) : null,
      url: `${origin}/v/${link.slug}`,
      followupsEnabled: link.followupsEnabled,
    };
  });

  const kindField = isWeb
    ? `Lien web${webHost ? `, ${webHost}` : ""}`
    : isVideo
      ? `Pitch vidéo, ${formatDuration(document.durationMs ?? 0)}`
      : [
          "PDF",
          document.numPages ? `${document.numPages} pages` : null,
          formatBytes(document.sizeBytes),
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <div className="space-y-8">
      {document.status === "PROCESSING" && <AutoRefresh intervalMs={2000} />}

      <div className="space-y-5">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Documents
        </Link>
        <ReportStrip
          fields={[
            "Fiche document",
            kindField,
            `${isWeb ? "ajouté" : isVideo ? "enregistré" : "importé"} le ${formatDate(document.createdAt)}`,
            `${document.links.length} lien${document.links.length > 1 ? "s" : ""} prospect`,
          ]}
        />
        <PageHeader
          title={document.name}
          description={
            document.status === "FAILED" ? (
              <span className="text-destructive">
                L&apos;analyse a échoué :{" "}
                {document.processingError ?? "erreur inconnue"}
              </span>
            ) : isWeb && document.externalUrl ? (
              <a
                href={document.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              >
                Ouvrir {webHost}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : !ready && !isVideo ? (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-1.5 animate-pulse bg-foreground motion-reduce:animate-none"
                />
                Analyse du document en cours, quelques secondes…
              </span>
            ) : undefined
          }
          action={
            <>
              <NewLinkButton documentId={document.id} />
              {/* Deleting takes every seller's links down with it */}
              {isManagerRole(role) && (
                <DeleteDocumentButton
                  documentId={document.id}
                  linkCount={document.links.length}
                />
              )}
            </>
          }
        />
        {analytics.viewCount > 0 && (
          <ReadingFields
            heat={documentHeat}
            video={isVideo}
            fields={[
              {
                label: analytics.viewCount === 1 ? "Lecture" : "Lectures",
                value: String(analytics.viewCount),
              },
              {
                label:
                  analytics.uniqueVisitors === 1
                    ? "Lecteur"
                    : "Lecteurs différents",
                value: String(analytics.uniqueVisitors),
              },
              {
                label: "Temps de lecture",
                value: formatDuration(analytics.totalDurationMs),
              },
              ...(analytics.lastActivityAt
                ? [
                    {
                      label: "Dernière lecture",
                      value: formatRelative(analytics.lastActivityAt, now),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>

      <Tabs defaultValue="prospects" className="gap-6">
        <TabsList
          variant="line"
          className="w-full justify-start gap-6 overflow-x-auto border-b border-border pb-px"
        >
          <TabsTrigger value="prospects" className="flex-none px-0 text-body">
            Prospects{" "}
            <span className="font-mono text-small text-muted-foreground">
              {document.links.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="reading" className="flex-none px-0 text-body">
            Lecture
          </TabsTrigger>
          <TabsTrigger value="content" className="flex-none px-0 text-body">
            Le document
          </TabsTrigger>
          <TabsTrigger value="followups" className="flex-none px-0 text-body">
            Relances
            {pendingFollowups > 0 && (
              <span className="font-mono text-small text-muted-foreground">
                {pendingFollowups}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prospects">
          {document.links.length === 0 ? (
            <EmptyState
              title="Créez un lien pour chaque prospect."
              description={
                isVideo
                  ? "Envoyez-le à la place d'un lien Loom. Vous verrez qui la regarde, jusqu'où, et Clozer relancera pour vous."
                  : isWeb
                    ? "Envoyez-le à la place du lien d'origine. Vous verrez qui l'ouvre, combien de temps il y passe, et Clozer relancera pour vous."
                    : "Envoyez-le à la place du PDF. Vous verrez qui l'ouvre, combien de temps il lit, et Clozer relancera pour vous."
              }
              action={
                <NewLinkButton documentId={document.id} variant="outline" />
              }
            />
          ) : (
            <DocumentLinks rows={prospectRows} video={isVideo} />
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-10">
          {/* A video pitch already is the seller speaking */}
          {!isVideo && (
            <section>
              <SectionTitle hint="vu par le prospect dès l'ouverture, sur tous les liens">
                Mot d&apos;accueil
              </SectionTitle>
              <WelcomeMessage
                documentId={document.id}
                linkId={null}
                documentWelcome={
                  welcome
                    ? {
                        id: welcome.id,
                        kind: welcome.kind,
                        hookText: welcome.hookText,
                        durationMs: welcome.durationMs,
                        plays: welcome._count.plays,
                      }
                    : null
                }
                linkWelcome={null}
                uploadPrefix={capsuleUploadPrefix(organization.id)}
              />
            </section>
          )}
          <section>
            <SectionTitle hint="décide du vocabulaire des étiquettes et de l'assistant">
              Type de document
            </SectionTitle>
            <DocumentTypeSelect
              documentId={document.id}
              docType={document.docType}
              setBySeller={document.docTypeSource === "MANUAL"}
            />
          </section>
          <section>
            <SectionTitle hint="pour répondre aux questions du prospect">
              Infos pour l&apos;assistant
            </SectionTitle>
            <AssistantNotesForm
              documentId={document.id}
              initial={document.assistantNotes ?? ""}
            />
          </section>
          <section>
            <SectionTitle
              hint={
                isVideo
                  ? "passage par passage, ce que Clozer a compris"
                  : "page par page, ce que Clozer a compris"
              }
            >
              Contenu
            </SectionTitle>
            {isWeb ? (
              <div className="space-y-6">
                <WebPageReading
                  documentId={document.id}
                  docPurpose={document.docPurpose}
                  page={document.pages[0] ?? null}
                  aiAvailable={getLanguageModel("classify") !== null}
                />
                <SellerDescriptionForm
                  documentId={document.id}
                  initial={document.sellerDescription ?? ""}
                />
              </div>
            ) : document.pages.length === 0 ? (
              <p className="border-y border-border py-12 text-center text-body text-muted-foreground">
                {ready
                  ? "Aucune page détectée."
                  : "Analyse du document en cours…"}
              </p>
            ) : (
              <DocumentPages
                documentId={document.id}
                pages={document.pages.map((page) => {
                  const capsule = document.capsules.find(
                    (c) => c.pageNumber === page.pageNumber,
                  );
                  return {
                    ...page,
                    capsule: capsule
                      ? {
                          id: capsule.id,
                          kind: capsule.kind,
                          hookText: capsule.hookText,
                          durationMs: capsule.durationMs,
                          plays: capsule._count.plays,
                        }
                      : null,
                  };
                })}
                capsuleUploadPrefix={capsuleUploadPrefix(organization.id)}
                aiRead={document.aiProcessedAt !== null}
                aiGaveUp={document.aiAttempts >= 3}
                docType={document.docType}
                docPurpose={document.docPurpose}
                aiAvailable={getLanguageModel("classify") !== null}
                video={isVideo}
              />
            )}
          </section>
          <section>
            <SectionTitle hint="tel que vos prospects le voient">
              Aperçu
            </SectionTitle>
            <DocumentPreviewSection document={document} ready={ready} />
          </section>
        </TabsContent>

        <TabsContent value="reading" className="space-y-10">
          {frictions.length > 0 && (
            <section>
              <SectionTitle hint="sur tous les prospects de ce document">
                Ce qui bloque
              </SectionTitle>
              <ul className="divide-y divide-border border-b border-border text-body">
                {frictions.map((line) => (
                  <li key={line} className="py-2.5">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {isWeb ? (
            <p className="max-w-2xl text-body text-muted-foreground">
              {videoProvider(document.embedUrl) === "loom"
                ? "Pour une vidéo Loom, Clozer mesure le temps passé sur la page, pas la part de la vidéo regardée."
                : videoProvider(document.embedUrl)
                  ? "Pour une vidéo, Clozer mesure le temps passé et la part réellement regardée (les passages sautés ne comptent pas)."
                  : document.embedUrl
                    ? "Pour un lien web, Clozer mesure le temps passé sur la page, sans détail page par page."
                    : document.readerHtml
                      ? "Ce site refuse l'affichage intégré : vos prospects lisent l'article dans Clozer. Clozer mesure le temps passé et jusqu'où ils l'ont lu."
                      : "Ce site s'ouvre dans un nouvel onglet : Clozer voit quand le prospect l'ouvre, et estime le temps passé dessus d'après son retour sur le lien."}
            </p>
          ) : (
            <section>
              <SectionTitle hint="toutes lectures confondues">
                {isVideo
                  ? "Temps passé sur chaque passage de la vidéo"
                  : "Temps passé par page"}
              </SectionTitle>
              {chartData.length > 0 && showsDetail ? (
                <Surface className="p-4">
                  <PageTimeChart data={chartData} video={isVideo} />
                </Surface>
              ) : (
                <p className="border-y border-border py-12 text-center text-body text-muted-foreground">
                  {chartData.length > 0
                    ? "Pas encore assez de lecture pour le détail par page."
                    : ready
                      ? "Aucune page détectée."
                      : "Analyse du document en cours…"}
                </p>
              )}
              {taggedPages.length > 0 && (
                <p className="mt-3 text-small text-muted-foreground">
                  Repéré automatiquement :{" "}
                  {taggedPages
                    .map(
                      (page) =>
                        `${pageName(page.pageNumber)} (${page.tags.map((t) => tagLabels(document.docType)[t].toLowerCase()).join(", ")})`,
                    )
                    .join(", ")}
                </p>
              )}
            </section>
          )}

          <section>
            <SectionTitle>Dernières lectures</SectionTitle>
            {analytics.recentViews.length === 0 ? (
              <p className="text-body text-muted-foreground">
                Personne n&apos;a encore ouvert ce document. Les lectures
                s&apos;afficheront ici.
              </p>
            ) : (
              <RecentReads
                rows={analytics.recentViews.map((view) => ({
                  id: view.id,
                  reader: readerLabels.get(view.id)?.name ?? "Lecteur",
                  deal: dealLabel(view.link),
                  where: [
                    [view.city, view.country].filter(Boolean).join(", ") ||
                      null,
                    view.timezone,
                    [view.deviceType, view.browser].filter(Boolean).join(" ") ||
                      null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  duration: formatDuration(view.totalDurationMs),
                  when: formatRelative(view.lastSeenAt, now),
                  at: formatDate(view.lastSeenAt),
                }))}
              />
            )}
            {anonymousReaders && (
              <p className="mt-3 max-w-2xl text-small text-muted-foreground">
                Ces lecteurs n&apos;ont pas donné leur email. Une même lettre,
                c&apos;est un même navigateur ; deux lettres, souvent deux
                personnes (ou la même sur deux appareils). Pour savoir
                exactement qui lit, activez « Demander l&apos;email avant
                lecture » dans les réglages du lien.
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="followups" className="space-y-10">
          <section className="space-y-4">
            <p className="max-w-2xl text-body text-muted-foreground">
              Les relances de tous les prospects de ce document. Clozer en écrit
              une quand il juge que c&apos;est le bon moment ; vous la relisez
              ici ou sur la fiche du prospect, puis vous la validez.
            </p>
            <Surface className="p-4">
              <FollowupsPanel followups={followupItems} showLink />
            </Surface>
          </section>

          {alerts.length > 0 && (
            <section>
              <SectionTitle>Alertes</SectionTitle>
              <DocumentAlerts
                now={now}
                alerts={alerts.map((alert) => ({
                  id: alert.id,
                  type: alert.type,
                  deal: dealLabel(alert.link),
                  payload: alert.payload,
                  channels: alert.channels,
                  sentAt: alert.sentAt,
                  error: alert.error,
                  createdAt: alert.createdAt,
                }))}
              />
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
