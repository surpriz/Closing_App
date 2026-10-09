import type { ModelMessage, UIMessage } from "ai";

import type { PageTag } from "@/generated/prisma/enums";

import type { ChatKindLabels } from "../i18n/viewer";

/** Chat messages between the database, the model and the widget. Pure. */

export type ChatMessageMetadata = { escalated?: boolean };
export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export type StoredChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  escalated: boolean;
};

export function toUIMessages(rows: StoredChatMessage[]): ChatUIMessage[] {
  // The flag is stored on the question; the widget shows it under the answer
  return rows.map((row, i) => ({
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    parts: [{ type: "text", text: row.content }],
    metadata: row.role === "ASSISTANT" && rows[i - 1]?.escalated ? { escalated: true } : undefined,
  }));
}

export function toModelMessages(rows: StoredChatMessage[]): ModelMessage[] {
  return rows
    .filter((row) => row.content.trim())
    .map((row) => ({ role: row.role === "USER" ? "user" : "assistant", content: row.content }));
}

/** Three questions the document can answer, worded for the reader and the kind of document. */
export function suggestQuestions(tags: Iterable<PageTag>, labels: ChatKindLabels): string[] {
  const present = new Set(tags);
  const byTag: [PageTag, string][] = [
    ["SCOPE", labels.scope],
    ["PRICING", labels.pricing],
    ["TIMELINE", labels.timing],
    ["TERMS", labels.terms],
  ];
  const picked = byTag.filter(([tag]) => present.has(tag)).map(([, question]) => question);
  for (const fallback of [labels.summary, labels.next]) {
    if (!picked.includes(fallback)) picked.push(fallback);
  }
  return picked.slice(0, 3);
}
