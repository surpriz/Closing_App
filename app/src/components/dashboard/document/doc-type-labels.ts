import type { useTranslations } from "next-intl";

import type { PageTag } from "@/generated/prisma/enums";
import { DOC_TYPES, type DocType } from "@/lib/closing/documents/doc-types";

export type DocumentsT = ReturnType<typeof useTranslations<"documents">>;

/** Name of a document type on screen. */
export function docTypeLabel(t: DocumentsT, docType: DocType) {
  return t(`docType.${docType}`);
}

/** Page tag names for the seller, adapted to the document type (same table as lib/closing/documents/doc-types). */
export function tagLabels(t: DocumentsT, docType: string | null | undefined): Record<PageTag, string> {
  const type = docType && (DOC_TYPES as readonly string[]).includes(docType) ? docType : null;
  const label = (tag: PageTag) => {
    const override = `tags.${type}.${tag}`;
    return type && t.has(override as never) ? t(override as never) : t(`tags.default.${tag}`);
  };
  return {
    PRICING: label("PRICING"),
    TERMS: label("TERMS"),
    TIMELINE: label("TIMELINE"),
    SCOPE: label("SCOPE"),
    TEAM: label("TEAM"),
    CASE_STUDY: label("CASE_STUDY"),
    OTHER: label("OTHER"),
  };
}
