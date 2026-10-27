import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SmartLinkProblem } from "@/lib/closing/shared/smart-params";

import { MakeSmartLinkButton } from "./make-smart-link-button";

export type SmartLinkProblemItem = { kind: SmartLinkProblem; tag: string | null; at: Date };

/**
 * Cold email readers this link could not name, said where the seller looks:
 * an address sent to a personal link, or a tool variable left as is.
 */
export async function SmartLinkProblemNotice({
  problems,
  linkId,
  documentId,
}: {
  problems: SmartLinkProblemItem[];
  linkId: string;
  documentId: string;
}) {
  if (problems.length === 0) return null;
  const t = await getTranslations("deal.smartLinkProblem");

  return (
    <div className="space-y-3">
      {problems.map((problem) => (
        <div
          key={problem.kind}
          role="status"
          className="flex gap-3 border-l-2 border-warning bg-card px-4 py-3 text-small"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {problem.kind === "personal_link"
                ? t("titlePersonal")
                : t("titleTag", { tag: problem.tag ?? "{{email}}" })}
            </p>
            <p className="text-muted-foreground">
              {problem.kind === "personal_link" ? t("bodyPersonal") : t("bodyTag")}
            </p>
            {problem.kind === "personal_link" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <MakeSmartLinkButton linkId={linkId} />
                <Link
                  href={`/documents/${documentId}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {t("createSmartLink")}
                </Link>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
