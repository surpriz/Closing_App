import type { DocType } from "../documents/doc-types";

/**
 * How the assistant talks about a document, by family of types. Pure. A
 * technical audit has no prices or conditions to ask about: the widget and the
 * prompt must not suggest them.
 */

export type ChatKind = "offer" | "technical" | "profile" | "document";

const KINDS: Partial<Record<DocType, ChatKind>> = {
  QUOTE: "offer",
  PROPOSAL: "offer",
  CONTRACT: "offer",
  INVOICE: "offer",
  TECHNICAL: "technical",
  RESUME: "profile",
};

export function chatKind(docType: string | null | undefined): ChatKind {
  return KINDS[docType as DocType] ?? "document";
}

/** What the model is told the document is, in English. */
const DOC_NOUNS: Record<DocType, string> = {
  QUOTE: "price quote",
  PROPOSAL: "business proposal",
  PRESENTATION: "presentation",
  TECHNICAL: "technical document (audit, specification or study)",
  RESUME: "résumé (professional profile)",
  INVOICE: "invoice",
  CONTRACT: "contract",
  CASE_STUDY: "case study",
  BROCHURE: "brochure",
  OTHER: "document",
};

export function docNoun(docType: string | null | undefined) {
  return DOC_NOUNS[docType as DocType] ?? "document";
}

/** One extra rule per family, so answers fit what the reader is looking at. */
export const KIND_GUIDANCE: Record<ChatKind, string> = {
  offer:
    "The reader is deciding whether to accept this offer: scope, prices, payment, timing and conditions are what matter most.",
  technical:
    "The reader wants to understand the findings, the recommendations and the plan. Explain technical points plainly, without jargon the document does not use, and never add technical advice the document does not give: if they ask how to implement something the document does not cover, escalate.",
  profile:
    "The document presents a person. Speak about them in the third person, by name when the document gives it. Questions about availability, rate or terms not stated in the document go to the seller.",
  document: "Answer about what this document actually covers. Do not assume it has prices or conditions.",
};
