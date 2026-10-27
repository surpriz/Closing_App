import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { DeleteDocumentButton } from "@/components/dashboard/delete-document-button";
import {
  HottestReading,
  ReportStrip,
  StateMark,
} from "@/components/dashboard/document/reading-bits";
import { HeatStrip } from "@/components/dashboard/heat-strip";
import { PageHeader } from "@/components/dashboard/page-header";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { documentUploadPrefix, pitchUploadPrefix } from "@/lib/blob";
import { getDocumentPageReadings } from "@/lib/closing/dashboard/document-readings";
import { pageHeat } from "@/lib/closing/dashboard/page-heat";
import { documentTitle } from "@/lib/closing/documents/link-title";
import { VIDEO_SEGMENTS } from "@/lib/closing/documents/video-segments";
import { prisma } from "@/lib/db";
import { formatDuration, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documents");
  return { title: t("metaTitle") };
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default async function DocumentsPage() {
  const { organization } = await requireWorkspace();
  const [t, tl, locale] = await Promise.all([
    getTranslations("documents.list"),
    getTranslations("labels"),
    getLocale(),
  ]);

  const documents = await prisma.document.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { links: { where: { archivedAt: null, draftAt: null } } },
      },
    },
  });
  const documentIds = documents.map((d) => d.id);

  const [viewStats, scores, readings, drafts] = await Promise.all([
    prisma.documentView.groupBy({
      by: ["documentId"],
      where: { documentId: { in: documentIds }, isBot: false },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    }),
    prisma.engagementScore.findMany({
      where: { link: { documentId: { in: documentIds }, archivedAt: null } },
      select: {
        score: true,
        tier: true,
        reasons: true,
        link: { select: { documentId: true } },
      },
    }),
    getDocumentPageReadings(documentIds),
    // Links made on drop and not sent yet: the document is not "unread", it has not gone out
    prisma.link.groupBy({
      by: ["documentId"],
      where: {
        documentId: { in: documentIds },
        archivedAt: null,
        draftAt: { not: null },
        isOnboardingTest: false,
      },
      _count: { _all: true },
    }),
  ]);
  const statsByDocument = new Map(viewStats.map((s) => [s.documentId, s]));
  const draftDocuments = new Set(drafts.map((d) => d.documentId));
  // What is being read opens the list, most recent reading first; the rest keeps upload order
  const lastRead = (id: string) =>
    statsByDocument.get(id)?._max.lastSeenAt?.getTime() ?? 0;
  const ordered = [...documents].sort(
    (a, b) => lastRead(b.id) - lastRead(a.id),
  );
  const bestScore = new Map<string, (typeof scores)[number]>();
  for (const score of scores) {
    const current = bestScore.get(score.link.documentId);
    if (!current || score.score > current.score)
      bestScore.set(score.link.documentId, score);
  }

  const uploadPrefix = documentUploadPrefix(organization.id);
  const pitchPrefix = pitchUploadPrefix(organization.id);
  const now = new Date();

  if (documents.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("title")} description={t("emptyDescription")} />
        <UploadDropzone
          uploadPrefix={uploadPrefix}
          pitchUploadPrefix={pitchPrefix}
        />
      </div>
    );
  }

  const linkTotal = documents.reduce((sum, d) => sum + d._count.links, 0);
  const readTotal = viewStats.reduce((sum, s) => sum + s._count._all, 0);

  return (
    <div className="space-y-6">
      <ReportStrip
        fields={[
          t("reportTitle"),
          t("documentCount", { count: documents.length }),
          t("sentLinkCount", { count: linkTotal }),
          t("readCount", { count: readTotal }),
        ]}
      />
      <PageHeader title={t("title")} description={t("description")} />

      <ul className="stagger divide-y divide-border border-y border-foreground bg-card">
        {ordered.map((document) => {
          const stats = statsByDocument.get(document.id);
          const score = bestScore.get(document.id);
          const reads = stats?._count._all ?? 0;
          const lastRead = stats?._max.lastSeenAt;
          const pages = readings.get(document.id);
          const isVideo = document.kind === "VIDEO";
          const heat =
            pages && pages.length > 0
              ? pageHeat(pages, isVideo ? VIDEO_SEGMENTS : document.numPages)
              : null;
          const processing =
            document.status === "PROCESSING" || document.status === "UPLOADED";
          const meta = [
            document.kind === "URL"
              ? t("webLink", {
                  host: hostOf(document.externalUrl) ?? t("externalPage"),
                })
              : null,
            isVideo
              ? t("videoPitch", {
                  duration: formatDuration(document.durationMs ?? 0),
                })
              : null,
            document.numPages && !isVideo
              ? t("pageCount", { count: document.numPages })
              : null,
            t("prospectCount", { count: document._count.links }),
            t("readCount", { count: reads }),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={document.id}
              className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-3 py-4 transition-colors duration-150 hover:bg-muted/60 sm:grid-cols-[7.25rem_minmax(0,1fr)_auto] sm:px-4"
            >
              <HeatStrip heat={heat} className="col-span-2 sm:col-span-1" />
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <Link
                    href={`/documents/${document.id}`}
                    className="min-w-0 truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                    title={document.name}
                  >
                    {documentTitle(document)}
                  </Link>
                  {!processing && document.status !== "FAILED" && (
                    <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground">
                      <StateMark
                        state={
                          score
                            ? tl(`tier.${score.tier}`)
                            : document._count.links === 0 &&
                                draftDocuments.has(document.id)
                              ? t("linkReady")
                              : t("notRead")
                        }
                        tier={score?.tier ?? null}
                        strong={!!score}
                      />
                      {lastRead && (
                        <span>
                          {t("readAgo", {
                            when: formatRelative(lastRead, locale, now),
                          })}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <p className="flex flex-wrap gap-x-2 text-small text-muted-foreground">
                  {processing ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-1.5 animate-pulse bg-foreground motion-reduce:animate-none"
                        aria-hidden
                      />
                      {t("processing")}
                    </span>
                  ) : document.status === "FAILED" ? (
                    <span className="text-destructive">
                      {t("failed")}
                    </span>
                  ) : (
                    <>
                      {document.kind !== "URL" && (
                        <HottestReading heat={heat} video={isVideo} />
                      )}
                      <span className="truncate">{meta}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="relative z-10 flex items-start">
                <DeleteDocumentButton
                  documentId={document.id}
                  linkCount={document._count.links}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
