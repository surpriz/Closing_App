import { FileText, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteDocumentButton } from "@/components/dashboard/delete-document-button";
import { HeatBar } from "@/components/dashboard/heat";
import { TIER_LABELS } from "@/components/dashboard/labels";
import { PageHeader } from "@/components/dashboard/page-header";
import { UploadButton, UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { documentUploadPrefix } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { formatRelative } from "@/lib/format";
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
    include: { _count: { select: { links: { where: { archivedAt: null, draftAt: null } } } } },
  });
  const documentIds = documents.map((d) => d.id);

  const [viewStats, scores] = await Promise.all([
    prisma.documentView.groupBy({
      by: ["documentId"],
      where: { documentId: { in: documentIds }, isBot: false },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    }),
    prisma.engagementScore.findMany({
      where: { link: { documentId: { in: documentIds }, archivedAt: null } },
      select: { score: true, tier: true, reasons: true, link: { select: { documentId: true } } },
    }),
  ]);
  const statsByDocument = new Map(viewStats.map((s) => [s.documentId, s]));
  const bestScore = new Map<string, (typeof scores)[number]>();
  for (const score of scores) {
    const current = bestScore.get(score.link.documentId);
    if (!current || score.score > current.score) bestScore.set(score.link.documentId, score);
  }

  const uploadPrefix = documentUploadPrefix(organization.id);
  const now = new Date();

  if (documents.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Documents"
          description="Ajoutez un PDF ou collez un lien (Notion, Loom, Figma…), puis créez un lien par prospect."
        />
        <UploadDropzone uploadPrefix={uploadPrefix} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Glissez un PDF ou collez un lien n'importe où sur la page pour l'ajouter."
        action={<UploadButton uploadPrefix={uploadPrefix} />}
      />

      <ul className="stagger divide-y divide-border overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
        {documents.map((document) => {
          const stats = statsByDocument.get(document.id);
          const score = bestScore.get(document.id);
          const reads = stats?._count._all ?? 0;
          const lastRead = stats?._max.lastSeenAt;
          return (
            <li
              key={document.id}
              className="relative flex items-stretch gap-4 py-4 pr-3 pl-4 transition-colors duration-150 hover:bg-muted/40"
            >
              <HeatBar tier={score?.tier ?? null} score={score?.score ?? 0} />
              <span className="flex size-10 shrink-0 items-center justify-center self-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                {document.kind === "URL" ? (
                  <Globe className="size-4.5" aria-hidden />
                ) : (
                  <FileText className="size-4.5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1 self-center">
                <Link
                  href={`/documents/${document.id}`}
                  className="block truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                >
                  {document.name}
                </Link>
                <p className="truncate text-small text-muted-foreground">
                  {document.status === "PROCESSING" || document.status === "UPLOADED" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
                      Analyse en cours…
                    </span>
                  ) : document.status === "FAILED" ? (
                    <span className="text-destructive">L&apos;analyse a échoué</span>
                  ) : (
                    [
                      document.kind === "URL" ? `Lien web, ${hostOf(document.externalUrl) ?? "page externe"}` : null,
                      plural(document._count.links, "prospect", "prospects"),
                      plural(reads, "lecture", "lectures"),
                      document.numPages ? plural(document.numPages, "page", "pages") : null,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  )}
                </p>
              </div>
              <div className="hidden shrink-0 flex-col items-end justify-center text-sm sm:flex">
                <span className={score ? "" : "text-muted-foreground"}>
                  {score ? TIER_LABELS[score.tier] : "Pas encore lu"}
                  {lastRead && <span className="text-muted-foreground">, lu {formatRelative(lastRead, now)}</span>}
                </span>
              </div>
              <div className="relative z-10 flex items-center">
                <DeleteDocumentButton documentId={document.id} linkCount={document._count.links} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
