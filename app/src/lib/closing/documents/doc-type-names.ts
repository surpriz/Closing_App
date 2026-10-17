import type { PageTag } from "@/generated/prisma/enums";
import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { DOC_TYPES, type DocType } from "./doc-types";

/**
 * Document type and section names in the seller's language, for server text
 * (deal facts, webhooks). Same keys as the screens (documents.docType / tags).
 */
export function tagNames(docType: string | null | undefined, locale: UiLocale): Record<PageTag, string> {
  const t = getNamespaceTranslator(locale, "documents");
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

export function docTypeName(docType: DocType, locale: UiLocale) {
  return getNamespaceTranslator(locale, "documents")(`docType.${docType}`);
}
