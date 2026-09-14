import Link from "next/link";

import { DocumentStatusBadge } from "@/components/dashboard/document-status-badge";
import { EngagementBadge } from "@/components/dashboard/engagement-badge";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { documentUploadPrefix } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";

export default async function DocumentsPage() {
  const { organization } = await requireWorkspace();

  const documents = await prisma.document.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { links: { where: { archivedAt: null } } } } },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Importez un devis, créez un lien par prospect et suivez sa lecture.
        </p>
      </div>

      <UploadDropzone uploadPrefix={documentUploadPrefix(organization.id)} />

      {documents.length > 0 && (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nom</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Meilleur intérêt</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead className="text-right">Liens</TableHead>
                  <TableHead className="text-right">Vues</TableHead>
                  <TableHead className="pr-4 text-right">Dernière lecture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => {
                  const stats = statsByDocument.get(document.id);
                  const score = bestScore.get(document.id);
                  return (
                    <TableRow key={document.id}>
                      <TableCell className="pl-4 font-medium">
                        <Link href={`/documents/${document.id}`} className="hover:underline">
                          {document.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge status={document.status} />
                      </TableCell>
                      <TableCell>
                        {score ? (
                          <EngagementBadge tier={score.tier} score={score.score} reasons={score.reasons} />
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{document.numPages ?? "–"}</TableCell>
                      <TableCell className="text-right">{document._count.links}</TableCell>
                      <TableCell className="text-right">{stats?._count._all ?? 0}</TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground">
                        {stats?._max.lastSeenAt ? formatRelative(stats._max.lastSeenAt) : "–"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
