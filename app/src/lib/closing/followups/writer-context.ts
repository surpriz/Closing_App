import type { PageTag } from "@/generated/prisma/enums";

import { tagLabels } from "../documents/doc-types";

/**
 * Which parts of the document the message writer gets, by follow-up goal.
 * Pure. Sections come with their name and summary, never a page number:
 * "page 7" in a follow-up would tell the prospect someone watched them read.
 */

const SECTIONS_BY_GOAL: Record<string, PageTag[]> = {
  clarify_pricing: ["PRICING", "TERMS"],
  address_objection: ["PRICING", "SCOPE", "CASE_STUDY"],
  share_case_study: ["CASE_STUDY", "TEAM"],
  propose_call: ["SCOPE", "TIMELINE"],
  gentle_reminder: ["SCOPE", "TIMELINE"],
  involve_decision_maker: ["SCOPE", "PRICING"],
  reactivate: ["SCOPE", "TIMELINE"],
};
const TRIGGER_GOAL: Record<string, string> = {
  HOT_PRICING: "clarify_pricing",
  ANTI_GHOSTING: "gentle_reminder",
  MANUAL: "gentle_reminder",
  AI_DECISION: "gentle_reminder",
};
const MAX_SECTIONS = 6;

export function pickRelevantSections(
  pages: { tags: PageTag[]; summary: string | null; keyFacts: string[] }[],
  goal: string | null,
  trigger: string,
  docType?: string | null,
) {
  const names = tagLabels(docType);
  const wanted = SECTIONS_BY_GOAL[goal ?? TRIGGER_GOAL[trigger] ?? "gentle_reminder"] ?? [];
  const sections: { section: string; summary: string | null; keyFacts: string[] }[] = [];
  for (const tag of wanted) {
    for (const page of pages) {
      if (!page.tags.includes(tag) || (!page.summary && page.keyFacts.length === 0)) continue;
      sections.push({ section: names[tag], summary: page.summary, keyFacts: page.keyFacts });
      if (sections.length >= MAX_SECTIONS) return sections;
    }
  }
  return sections;
}

/** Everything a follow-up may quote figures and dates from. */
export function guardSourceText(input: {
  pages: { text: string | null; keyFacts: string[] }[];
  sellerDescription: string | null;
  senderSignature: string | null;
  offerDescription: string | null;
  valueProps: string | null;
}) {
  return [
    ...input.pages.flatMap((page) => [page.text ?? "", ...page.keyFacts]),
    input.sellerDescription,
    input.senderSignature,
    input.offerDescription,
    input.valueProps,
  ]
    .filter(Boolean)
    .join("\n");
}
