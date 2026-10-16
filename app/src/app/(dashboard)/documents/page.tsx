import type { Metadata } from "next";
import Link from "next/link";

import { DeleteDocumentButton } from "@/components/dashboard/delete-document-button";
import {
  HottestReading,
  ReportStrip,
  StateMark,
} from "@/components/dashboard/document/reading-bits";
import { HeatStrip } from "@/components/dashboard/heat-strip";
import { TIER_LABELS } from "@/components/dashboard/labels";
import { PageHeader } from "@/components/dashboard/page-header";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { documentUploadPrefix, pitchUploadPrefix } from "@/lib/blob";
import { getDocumentPageReadings } from "@/lib/closing/dashboard/document-readings";
import { pageHeat } from "@/lib/closing/dashboard/page-heat";
import { VIDEO_SEGMENTS } from "@/lib/closing/documents/video-segments";
import { prisma } from "@/lib/db";
import { formatDuration, formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Documents" };

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
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
        <PageHeader
          title="Documents"
          description="Ajoutez un PDF ou collez un lien (Notion, Loom, Figma…), puis créez un lien par prospect."
        />
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
          "Relevé des documents",
          plural(documents.length, "document", "documents"),
          plural(linkTotal, "lien envoyé", "liens envoyés"),
          plural(readTotal, "lecture", "lectures"),
        ]}
      />
      <PageHeader
        title="Documents"
        description="Glissez un PDF ou collez un lien n'importe où dans Clozer pour l'ajouter, ou utilisez « Ajouter un document » en haut."
      />

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
              ? `Lien web, ${hostOf(document.externalUrl) ?? "page externe"}`
              : null,
            isVideo
              ? `Pitch vidéo, ${formatDuration(document.durationMs ?? 0)}`
              : null,
            document.numPages && !isVideo
              ? plural(document.numPages, "page", "pages")
              : null,
            plural(document._count.links, "prospect", "prospects"),
            plural(reads, "lecture", "lectures"),
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
                  >
                    {document.name}
                  </Link>
                  {!processing && document.status !== "FAILED" && (
                    <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground">
                      <StateMark
                        state={
                          score
                            ? TIER_LABELS[score.tier]
                            : document._count.links === 0 &&
                                draftDocuments.has(document.id)
                              ? "Lien prêt, pas encore envoyé"
                              : "Pas encore lu"
                        }
                        tier={score?.tier ?? null}
                        strong={!!score}
                      />
                      {lastRead && (
                        <span>· lu {formatRelative(lastRead, now)}</span>
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
                      Analyse en cours…
                    </span>
                  ) : document.status === "FAILED" ? (
                    <span className="text-destructive">
                      L&apos;analyse a échoué. Ouvrez le document pour voir
                      pourquoi.
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
