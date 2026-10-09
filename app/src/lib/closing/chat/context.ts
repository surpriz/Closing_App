import type { PageTag } from "@/generated/prisma/enums";

import { DOC_TYPE_LABELS, tagLabels, type DocType } from "../documents/doc-types";

import { CHAT_CONTEXT_CHARS, CHAT_PAGE_TEXT_MAX } from "./constants";

/**
 * What the prospect assistant may know, turned into the model context. Pure.
 * The type is the allow-list: private seller fields (deal notes, objection
 * playbook) have no slot here, so they cannot reach a prospect by mistake.
 * The assistant notes are written by the seller for prospects to be told.
 */

export type ChatKnowledge = {
  document: {
    title: string;
    kind: "FILE" | "URL";
    docType: string | null;
    docPurpose: string | null;
    /** URL documents have no text: what the seller says the page is about. */
    sellerDescription: string | null;
    /** What the seller added for the assistant on this document. */
    assistantNotes: string | null;
  };
  pages: {
    pageNumber: number;
    text: string | null;
    summary: string | null;
    keyFacts: string[];
    tags: PageTag[];
  }[];
  workspace: {
    offerDescription: string | null;
    valueProps: string | null;
    /** What the seller wants the assistant to know on every document. */
    assistantKnowledge: string | null;
  };
};

export type ChatContext = {
  text: string;
  /** Everything an answer may quote, for the figure and date checks. */
  sourceText: string;
};

// Pages a prospect asks about most, kept in full first when the budget is tight
const TAG_PRIORITY: PageTag[] = ["PRICING", "TERMS", "SCOPE", "TIMELINE"];
const INDEX_LINE_MAX = 400;

/** The assistant has something to answer from. */
export function hasChatKnowledge(k: ChatKnowledge) {
  return (
    !!k.document.sellerDescription?.trim() ||
    !!k.document.assistantNotes?.trim() ||
    k.pages.some((p) => p.text?.trim() || p.summary?.trim())
  );
}

function pageRank(tags: PageTag[]) {
  const ranks = tags.map((tag) => TAG_PRIORITY.indexOf(tag)).filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : TAG_PRIORITY.length;
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildChatContext(k: ChatKnowledge, budget = CHAT_CONTEXT_CHARS): ChatContext {
  const labels = tagLabels(k.document.docType);
  const docTypeLabel = k.document.docType ? (DOC_TYPE_LABELS[k.document.docType as DocType] ?? null) : null;
  const sections: string[] = [];
  const sources: string[] = [];

  const overview = [
    `Title: ${k.document.title}`,
    docTypeLabel && `Type: ${docTypeLabel}`,
    k.document.docPurpose && `Purpose: ${k.document.docPurpose}`,
    k.document.sellerDescription && `Seller's description: ${k.document.sellerDescription}`,
    k.pages.length > 0 && `Pages: ${k.pages.length}`,
  ].filter(Boolean);
  sections.push(`<document_overview>\n${overview.join("\n")}\n</document_overview>`);
  if (k.document.sellerDescription) sources.push(k.document.sellerDescription);

  // Every page is listed, even when its full text does not fit
  if (k.pages.length) {
    const index = k.pages.map((page) => {
      const tags = page.tags.filter((t) => t !== "OTHER").map((t) => labels[t]);
      const parts = [
        `Page ${page.pageNumber}${tags.length ? ` [${tags.join(", ")}]` : ""}`,
        page.summary,
        page.keyFacts.length ? `Key facts: ${page.keyFacts.join(" · ")}` : null,
      ].filter(Boolean);
      sources.push(...page.keyFacts);
      return clip(parts.join(" — "), INDEX_LINE_MAX);
    });
    sections.push(`<page_index>\n${index.join("\n")}\n</page_index>`);
  }

  const offer = [
    k.workspace.offerDescription && `What the seller offers: ${k.workspace.offerDescription}`,
    k.workspace.valueProps && `Why clients choose them: ${k.workspace.valueProps}`,
  ].filter(Boolean);
  const offerSection = offer.length ? `<seller_offer>\n${offer.join("\n")}\n</seller_offer>` : null;
  if (k.workspace.offerDescription) sources.push(k.workspace.offerDescription);
  if (k.workspace.valueProps) sources.push(k.workspace.valueProps);

  // Written by the seller for this purpose: always kept, before any page text
  const notes = k.document.assistantNotes?.trim();
  if (notes) {
    sections.push(`<seller_notes_on_this_document>\n${notes}\n</seller_notes_on_this_document>`);
    sources.push(notes);
  }
  const knowledge = k.workspace.assistantKnowledge?.trim();
  const knowledgeSection = knowledge ? `<seller_knowledge>\n${knowledge}\n</seller_knowledge>` : null;
  if (knowledge) sources.push(knowledge);

  let used = sections.join("\n\n").length + (offerSection?.length ?? 0) + (knowledgeSection?.length ?? 0);
  const ranked = k.pages
    .filter((page) => page.text?.trim())
    .sort((a, b) => pageRank(a.tags) - pageRank(b.tags) || a.pageNumber - b.pageNumber);
  const kept: { pageNumber: number; text: string; tags: PageTag[] }[] = [];
  for (const page of ranked) {
    const text = clip(page.text!.trim(), CHAT_PAGE_TEXT_MAX);
    if (used + text.length > budget) continue;
    used += text.length;
    kept.push({ pageNumber: page.pageNumber, text, tags: page.tags });
  }
  for (const page of kept.sort((a, b) => a.pageNumber - b.pageNumber)) {
    sections.push(`<page number="${page.pageNumber}">\n${page.text}\n</page>`);
    sources.push(page.text);
  }
  if (kept.length < ranked.length) {
    sections.push("<note>Some pages are only in the index above: their full text did not fit.</note>");
  }

  if (offerSection) sections.push(offerSection);
  if (knowledgeSection) sections.push(knowledgeSection);
  return { text: sections.join("\n\n"), sourceText: sources.join("\n") };
}
