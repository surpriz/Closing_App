import { prisma } from "@/lib/db";

import { HOUR_MS } from "../constants";

import { CHAT_HISTORY_MAX } from "./constants";
import type { ChatKnowledge } from "./context";
import { chatKind } from "./kind";
import type { StoredChatMessage } from "./messages";

/** What the assistant may know. Selects only the fields ChatKnowledge allows, plus the name it speaks for. */
export async function loadChatKnowledge(link: {
  documentId: string;
  organizationId: string;
}): Promise<{ knowledge: ChatKnowledge; senderName: string | null } | null> {
  const [document, settings] = await Promise.all([
    prisma.document.findUnique({
      where: { id: link.documentId },
      select: {
        name: true,
        displayTitle: true,
        kind: true,
        docType: true,
        docPurpose: true,
        sellerDescription: true,
        assistantNotes: true,
        pages: {
          orderBy: { pageNumber: "asc" },
          select: { pageNumber: true, text: true, summary: true, keyFacts: true, tags: true },
        },
      },
    }),
    prisma.workspaceSettings.findUnique({
      where: { organizationId: link.organizationId },
      select: { senderName: true, offerDescription: true, valueProps: true, assistantKnowledge: true },
    }),
  ]);
  if (!document) return null;

  const knowledge: ChatKnowledge = {
    document: {
      title: document.displayTitle ?? document.name,
      kind: document.kind,
      docType: document.docType,
      docPurpose: document.docPurpose,
      sellerDescription: document.sellerDescription,
      assistantNotes: document.assistantNotes,
    },
    pages: document.pages,
    workspace: {
      offerDescription: settings?.offerDescription ?? null,
      valueProps: settings?.valueProps ?? null,
      assistantKnowledge: settings?.assistantKnowledge ?? null,
    },
  };
  return { knowledge, senderName: settings?.senderName?.trim() || null };
}

/**
 * The latest messages of this browser on this link, oldest first. By visitor,
 * not by view: a view ends after 30 minutes and the conversation must not.
 */
export async function loadChatHistory(linkId: string, visitorId: string | null | undefined): Promise<StoredChatMessage[]> {
  if (!visitorId) return [];
  const rows = await prisma.chatMessage.findMany({
    where: { linkId, view: { visitorId } },
    orderBy: { createdAt: "desc" },
    take: CHAT_HISTORY_MAX,
    select: { id: true, role: true, content: true, escalated: true },
  });
  return rows.reverse();
}

/** Questions already asked, for the per-session, per-browser and per-network limits. */
export async function countRecentQuestions(input: {
  linkId: string;
  viewId: string;
  visitorId: string;
  ipHash: string | null;
  now: Date;
}) {
  const hourAgo = new Date(input.now.getTime() - HOUR_MS);
  const dayStart = new Date(input.now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [viewLastHour, visitorToday, ipLastHour] = await Promise.all([
    prisma.chatMessage.count({ where: { viewId: input.viewId, role: "USER", createdAt: { gte: hourAgo } } }),
    prisma.chatMessage.count({
      where: { linkId: input.linkId, role: "USER", view: { visitorId: input.visitorId }, createdAt: { gte: dayStart } },
    }),
    // Across links and workspaces: one network hammering the assistant
    input.ipHash
      ? prisma.chatMessage.count({ where: { role: "USER", view: { ipHash: input.ipHash }, createdAt: { gte: hourAgo } } })
      : 0,
  ]);
  return { viewLastHour, visitorToday, ipLastHour };
}

/**
 * What the viewer page needs to show the assistant: whether the document has
 * anything to answer from, its page tags for the suggested questions, and
 * this browser's conversation so a reload keeps it.
 */
export async function loadChatSetup(link: { id: string; documentId: string }, visitorId: string | null | undefined) {
  const [document, history] = await Promise.all([
    prisma.document.findUnique({
      where: { id: link.documentId },
      select: {
        docType: true,
        sellerDescription: true,
        assistantNotes: true,
        pages: {
          where: { OR: [{ text: { not: null } }, { summary: { not: null } }] },
          select: { tags: true },
        },
      },
    }),
    loadChatHistory(link.id, visitorId),
  ]);
  const hasKnowledge =
    !!document &&
    (document.pages.length > 0 || !!document.sellerDescription?.trim() || !!document.assistantNotes?.trim());
  return {
    hasKnowledge,
    kind: chatKind(document?.docType),
    tags: document?.pages.flatMap((page) => page.tags) ?? [],
    history,
  };
}
