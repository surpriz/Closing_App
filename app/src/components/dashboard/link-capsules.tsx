import { useTranslations } from "next-intl";

import { PageCapsuleControl, type CapsuleSummary } from "@/components/dashboard/page-capsule";

export type LinkCapsuleRow = CapsuleSummary & { pageNumber: number; forLink: boolean };

/**
 * Page capsules this prospect still sees, recorded before the welcome message
 * replaced them: they play on their page and can be removed, not re-recorded.
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
  const t = useTranslations("deal.linkCapsules");
  const byPage = new Map(capsules.map((c) => [c.pageNumber, c]));
  const target = (pageNumber: number) => ({ documentId, linkId, pageNumber, uploadPrefix });
  const withCapsule = pages.filter((p) => byPage.has(p.pageNumber));

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {withCapsule.map((page) => {
          const capsule = byPage.get(page.pageNumber)!;
          return (
            <li key={page.pageNumber} className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
              <span className="font-mono text-small text-muted-foreground">P.{page.pageNumber}</span>
              <div className="min-w-0 space-y-2">
                <p className="text-small text-muted-foreground">
                  {capsule.forLink ? t("forLink") : t("documentCapsule")}
                </p>
                {canEdit && capsule.forLink ? (
                  <PageCapsuleControl target={target(page.pageNumber)} capsule={capsule} legacy />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body">
                      {capsule.hookText ?? t("noHook")}
                      <span className="text-muted-foreground">
                        {" "}
                        · {capsule.plays === 0 ? t("notWatched") : t("watched", { count: capsule.plays })}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
