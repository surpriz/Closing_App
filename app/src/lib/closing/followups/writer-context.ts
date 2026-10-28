import type { PageTag } from "@/generated/prisma/enums";

import { DAY_MS } from "../constants";
import { tagLabels } from "../documents/doc-types";

type SentMail = { sentAt: Date; subject: string | null; body: string | null };

/**
 * What the prospect already received, newest first, at most `max`: the link's follow-ups plus, for a campaign
 * follow-up, the campaign's fixed steps (its own AI follow-ups are already among the link's). Pure.
 */
export function previousMessagesOf(
  followups: (SentMail & { channel: string })[],
  campaignSteps: SentMail[],
  now: Date,
  max = 3,
) {
  return [...followups, ...campaignSteps.map((step) => ({ ...step, channel: "EMAIL" }))]
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, max)
    .map((mail) => ({
      daysAgo: Math.floor((now.getTime() - mail.sentAt.getTime()) / DAY_MS),
      channel: mail.channel,
      subject: mail.subject,
      excerpt: (mail.body ?? "").slice(0, 300),
    }));
}

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
  expiry_reminder: ["PRICING", "TERMS", "TIMELINE"],
  follow_reading: ["CASE_STUDY", "SCOPE", "TEAM"],
};
const TRIGGER_GOAL: Record<string, string> = {
  HOT_PRICING: "clarify_pricing",
  ANTI_GHOSTING: "gentle_reminder",
  MANUAL: "gentle_reminder",
  AI_DECISION: "gentle_reminder",
  EXPIRY_REMINDER: "expiry_reminder",
  WARM_READ: "follow_reading",
  INTEREST_RETURNED: "gentle_reminder",
  COLD_READ: "follow_reading",
  COLD_READ_PRICING: "clarify_pricing",
  COLD_REACTIVATE: "reactivate",
};
const MAX_SECTIONS = 6;

export function pickRelevantSections(
  pages: { tags: PageTag[]; summary: string | null; keyFacts: string[] }[],
  goal: string | null,
  trigger: string,
  docType?: string | null,
  /** What the reader spent the most time on, first: the topic, never how it was read. */
  readTags?: PageTag[],
) {
  const names = tagLabels(docType);
  const read = readTags?.filter((tag) => tag !== "OTHER") ?? [];
  const wanted = read.length > 0 ? read : (SECTIONS_BY_GOAL[goal ?? TRIGGER_GOAL[trigger] ?? "gentle_reminder"] ?? []);
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
