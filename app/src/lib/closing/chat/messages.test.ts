import { describe, expect, it } from "vitest";

import { getViewerLabels } from "../i18n/viewer";

import { suggestQuestions, toModelMessages, toUIMessages, type StoredChatMessage } from "./messages";

const rows: StoredChatMessage[] = [
  { id: "1", role: "USER", content: "Une remise ?", escalated: true },
  { id: "2", role: "ASSISTANT", content: "J'ai transmis votre question.", escalated: false },
  { id: "3", role: "USER", content: "Le délai ?", escalated: false },
  { id: "4", role: "ASSISTANT", content: "", escalated: false },
];

describe("toUIMessages", () => {
  it("shows the forwarded badge under the answer to a forwarded question", () => {
    const messages = toUIMessages(rows);
    expect(messages[1].metadata).toEqual({ escalated: true });
    expect(messages[3].metadata).toBeUndefined();
    expect(messages[0]).toMatchObject({ role: "user", parts: [{ type: "text", text: "Une remise ?" }] });
  });
});

describe("toModelMessages", () => {
  it("drops empty answers", () => {
    expect(toModelMessages(rows)).toHaveLength(3);
  });
});

describe("suggestQuestions", () => {
  const labels = getViewerLabels("fr");

  it("asks about what the document covers", () => {
    expect(suggestQuestions(["PRICING", "SCOPE", "TERMS"], labels)).toEqual([
      labels.chatSuggestScope,
      labels.chatSuggestPricing,
      labels.chatSuggestTerms,
    ]);
  });

  it("falls back to generic questions", () => {
    expect(suggestQuestions([], labels)).toEqual([labels.chatSuggestSummary, labels.chatSuggestNext]);
  });
});
