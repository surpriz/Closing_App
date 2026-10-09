import { prisma } from "@/lib/db";

import { HOUR_MS } from "../constants";
import { notifySeller } from "../notify/notify";

import { CHAT_ESCALATIONS_PER_LINK_HOUR } from "./constants";
import { contactEmailFromConversation, escalationDedupeKey } from "./escalation";

/**
 * The assistant could not answer: the question is marked on the deal page and
 * the seller is alerted, unless this is the seller testing their own link or
 * the prospect already sent several questions this hour.
 */
export async function escalateQuestion(input: {
  link: { id: string };
  view: { id: string; fromSeller: boolean };
  questionRowId: string;
  question: string;
  contactEmail?: string;
  /** Everything the reader typed in this conversation, to check contactEmail. */
  userTexts: string[];
  access: { email: string | null };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.view.fromSeller) return { forwarded: false, reason: "seller_preview" as const };
  await prisma.chatMessage.update({ where: { id: input.questionRowId }, data: { escalated: true } });

  const recent = await prisma.sellerAlert.count({
    where: { linkId: input.link.id, type: "PROSPECT_QUESTION", createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
  });
  // Still promised: the question shows on the deal page and in the morning digest
  if (recent >= CHAT_ESCALATIONS_PER_LINK_HOUR) return { forwarded: true, reason: "throttled" as const };

  const prospect = input.access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: input.link.id, email: input.access.email } },
        select: { name: true, email: true },
      })
    : null;
  const prospectEmail =
    prospect?.email ?? input.access.email ?? contactEmailFromConversation(input.contactEmail, input.userTexts);

  await notifySeller({
    linkId: input.link.id,
    type: "PROSPECT_QUESTION",
    dedupeKey: escalationDedupeKey(input.view.id, input.question),
    payload: { question: input.question, prospectName: prospect?.name ?? null, prospectEmail, viewId: input.view.id },
    now,
  });
  return { forwarded: true, reason: "sent" as const };
}
