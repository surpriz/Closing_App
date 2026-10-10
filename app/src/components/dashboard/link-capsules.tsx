import { PageCapsuleControl, type CapsuleSummary } from "@/components/dashboard/page-capsule";

export type LinkCapsuleRow = CapsuleSummary & { pageNumber: number; forLink: boolean };

/**
 * The capsules this prospect sees, page by page: the document's, or one
 * recorded for this link only, which replaces it here.
 */
export function LinkCapsules({
  documentId,
  linkId,
  pages,
  capsules,
  canEdit,
  uploadPrefix,
}: {
  documentId: string;
  linkId: string;
  pages: { pageNumber: number; summary: string | null }[];
  capsules: LinkCapsuleRow[];
  canEdit: boolean;
  uploadPrefix: string;
}) {
  const byPage = new Map(capsules.map((c) => [c.pageNumber, c]));
  const target = (pageNumber: number) => ({ documentId, linkId, pageNumber, uploadPrefix });
  const withCapsule = pages.filter((p) => byPage.has(p.pageNumber));
  const without = pages.filter((p) => !byPage.has(p.pageNumber));

  return (
    <div className="space-y-3">
      {withCapsule.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune capsule. Enregistrez quelques secondes de vive voix sur une page clé : le prospect la voit en arrivant dessus.
        </p>
      )}
      <ul className="divide-y divide-border">
        {withCapsule.map((page) => {
          const capsule = byPage.get(page.pageNumber)!;
          return (
            <li key={page.pageNumber} className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
              <span className="text-sm font-medium text-muted-foreground tabular-nums">p.{page.pageNumber}</span>
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {capsule.forLink ? "Enregistrée pour ce prospect" : "Capsule du document, vue par tous les prospects"}
                </p>
                {canEdit && capsule.forLink ? (
                  <PageCapsuleControl target={target(page.pageNumber)} capsule={capsule} />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      {capsule.hookText ?? "Sans phrase d'accroche"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {capsule.plays === 0 ? "pas encore regardée ici" : `regardée ${capsule.plays} fois ici`}
                      </span>
                    </p>
                    {canEdit && (
                      <PageCapsuleControl target={target(page.pageNumber)} capsule={capsule} inherited />
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {canEdit && without.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Ajouter une capsule sur une autre page
          </summary>
          <ul className="mt-2 divide-y divide-border">
            {without.map((page) => (
              <li key={page.pageNumber} className="flex items-center gap-4 py-2">
                <span className="w-12 shrink-0 text-sm font-medium text-muted-foreground tabular-nums">p.{page.pageNumber}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{page.summary}</span>
                <PageCapsuleControl target={target(page.pageNumber)} capsule={null} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
