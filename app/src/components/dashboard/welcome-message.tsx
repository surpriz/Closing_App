"use client";

import { useTranslations } from "next-intl";

import { WELCOME_PAGE } from "@/lib/closing/capsules/resolve";

import { PageCapsuleControl, type CapsuleSummary } from "./page-capsule";

/**
 * The seller's video or voice message for the whole document, shown to the
 * prospect from the first page. Recorded once for the document; a personal
 * link can carry its own version, which replaces it there.
 */
export function WelcomeMessage({
  documentId,
  linkId,
  documentWelcome,
  linkWelcome,
  uploadPrefix,
}: {
  documentId: string;
  /** A personal link: offers a version for this prospect only. Null on the document page or a shared link. */
  linkId: string | null;
  documentWelcome: CapsuleSummary | null;
  linkWelcome: CapsuleSummary | null;
  uploadPrefix: string;
}) {
  const t = useTranslations("onboarding.welcomeMessage");
  const forDocument = { documentId, linkId: null, pageNumber: WELCOME_PAGE, uploadPrefix };
  const forLink = linkId ? { documentId, linkId, pageNumber: WELCOME_PAGE, uploadPrefix } : null;

  if (forLink && linkWelcome) {
    return (
      <div className="space-y-1.5">
        <p className="text-small text-muted-foreground">{t("linkVersion")}</p>
        <PageCapsuleControl target={forLink} capsule={linkWelcome} />
      </div>
    );
  }

  if (!documentWelcome) {
    return <PageCapsuleControl target={forDocument} capsule={null} addLabel={t("record")} />;
  }

  return (
    <div className="space-y-2">
      <PageCapsuleControl target={forDocument} capsule={documentWelcome} />
      {forLink && (
        <PageCapsuleControl target={forLink} capsule={documentWelcome} inherited addLabel={t("personal")} />
      )}
    </div>
  );
}
