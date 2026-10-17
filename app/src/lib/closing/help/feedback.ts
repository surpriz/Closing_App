import type { HelpFeedbackKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderEmail, type EmailBlock, type EmailContent } from "@/lib/email-layout";
import { getEnv } from "@/lib/env";

import { pageLabel } from "./context";

/**
 * What the help assistant sends the Clozer team: stored, then emailed to HELP_INBOX_EMAIL when set.
 * Read by the team, not the seller: stays in French.
 */

export const FEEDBACK_KINDS = ["SUGGESTION", "BUG", "QUESTION", "OTHER"] as const satisfies readonly HelpFeedbackKind[];

const KIND_LABELS: Record<HelpFeedbackKind, string> = {
  SUGGESTION: "Suggestion",
  BUG: "Bug",
  QUESTION: "Question sans réponse",
  OTHER: "Commentaire",
};

export type FeedbackInput = {
  kind: HelpFeedbackKind;
  summary: string;
  details?: string | null;
  pathname?: string | null;
  user: { name: string | null; email: string };
  workspaceName: string;
  role: string;
  /** The user's own messages in this conversation, for context. */
  userTexts: string[];
};

/** Pure: the email the team receives. */
export function feedbackEmail(input: FeedbackInput): EmailContent & { subject: string } {
  const label = KIND_LABELS[input.kind];
  const who = input.user.name ? `${input.user.name} (${input.user.email})` : input.user.email;
  const page = input.pathname ? `${input.pathname}${pageLabel(input.pathname) ? ` · ${pageLabel(input.pathname)}` : ""}` : null;
  const blocks: EmailBlock[] = [
    { kind: "quote", text: input.summary },
    ...(input.details?.trim() ? [{ kind: "text" as const, text: input.details.trim() }] : []),
    {
      kind: "list",
      items: [
        { text: "De", detail: who },
        { text: "Workspace", detail: `${input.workspaceName} · ${input.role}` },
        ...(page ? [{ text: "Page", detail: page }] : []),
      ],
    },
  ];
  const recent = input.userTexts.slice(-3);
  if (recent.length) {
    blocks.push({ kind: "heading", text: "Ses derniers messages à l'assistant" });
    blocks.push({ kind: "text", text: recent.map((text) => `« ${text} »`).join("\n\n") });
  }
  const subject = `[Clozer ${label}] ${input.summary.slice(0, 80)}`;
  return { subject, locale: "fr", preheader: `${label} de ${who}`, title: `${label} de ${input.user.name ?? input.user.email}`, blocks };
}

export async function saveFeedback(input: FeedbackInput & { organizationId: string; userId: string }) {
  const row = await prisma.helpFeedback.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.kind,
      summary: input.summary,
      details: input.details?.trim() || null,
      pathname: input.pathname ?? null,
    },
    select: { id: true },
  });

  const to = getEnv().HELP_INBOX_EMAIL;
  if (!to || !isEmailConfigured()) return { saved: true, emailed: false };
  try {
    const { subject, ...content } = feedbackEmail(input);
    const { html, text } = renderEmail(content);
    await sendEmail({ to, subject, html, text, replyTo: input.user.email });
    await prisma.helpFeedback.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
    return { saved: true, emailed: true };
  } catch (error) {
    // Stored all the same: the team finds it in help_feedback
    console.error("[help] feedback email failed", row.id, error);
    return { saved: true, emailed: false };
  }
}
