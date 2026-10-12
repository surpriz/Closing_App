import { createUIMessageStreamResponse, isStepCount, streamText, tool, toUIMessageStream } from "ai";
import { after } from "next/server";
import { z } from "zod";

import { getLanguageModel, THINKING_ROOM_TOKENS } from "@/lib/closing/ai/provider";
import { recordAiUsage } from "@/lib/closing/ai/usage";
import { canHelp } from "@/lib/closing/brain/budget";
import { toModelMessages, toUIMessages } from "@/lib/closing/chat/messages";
import { HELP_MESSAGE_MAX } from "@/lib/closing/help/constants";
import { formatHelpContext, loadHelpContext } from "@/lib/closing/help/context";
import { faqAsText } from "@/lib/closing/help/faq";
import { FEEDBACK_KINDS, saveFeedback } from "@/lib/closing/help/feedback";
import { HELP_GUIDE } from "@/lib/closing/help/guide";
import { buildHelpInstructions } from "@/lib/closing/help/prompts";
import { canSendFeedback, countRecentHelpQuestions, loadHelpHistory } from "@/lib/closing/help/queries";
import { decideHelpQuota } from "@/lib/closing/help/quota";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/session";

export const maxDuration = 60;

/** The guide and the FAQ page, so the assistant and /faq never disagree. Same for everyone: cached. */
const KNOWLEDGE = `${HELP_GUIDE}\n## Questions fréquentes (page /faq)\n${faqAsText()}\n`;

/** Messages shown when the panel opens: the whole current conversation, not just what the model gets. */
const SHOWN_HISTORY_MAX = 50;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(HELP_MESSAGE_MAX),
  pathname: z.string().max(200).startsWith("/").nullish(),
});

/** The user's current conversation with the help assistant. */
export async function GET() {
  const workspace = await getWorkspace();
  if (!workspace) return Response.json({ error: "unauthorized" }, { status: 401 });
  const history = await loadHelpHistory(workspace.user.id, new Date(), SHOWN_HISTORY_MAX);
  return Response.json({ messages: toUIMessages(history) });
}

/**
 * A user asks the help assistant about Clozer. Like the prospect assistant,
 * only the new question comes from the browser: the conversation is read
 * back from the database.
 */
export async function POST(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { text } = parsed.data;
  const pathname = parsed.data.pathname ?? null;
  const { user, organization, role } = workspace;

  const llm = getLanguageModel("help");
  if (!llm) return Response.json({ error: "unavailable" }, { status: 503 });

  const now = new Date();
  const [counts, budgetAllowed] = await Promise.all([countRecentHelpQuestions(user.id, now), canHelp(now)]);
  const quotaError = decideHelpQuota({ ...counts, budgetAllowed });
  if (quotaError) return Response.json({ error: quotaError }, { status: 429 });

  const [state, history] = await Promise.all([
    loadHelpContext({
      organizationId: organization.id,
      organizationName: organization.name,
      userId: user.id,
      userName: user.name,
      role,
    }),
    loadHelpHistory(user.id, now),
  ]);

  const question = await prisma.helpMessage.create({
    data: { organizationId: organization.id, userId: user.id, role: "USER", content: text, pathname },
    select: { id: true },
  });
  const userTexts = [...history.filter((m) => m.role === "USER").map((m) => m.content), text];

  const startedAt = Date.now();
  const result = streamText({
    model: llm.model,
    instructions: buildHelpInstructions({ guide: KNOWLEDGE, contextText: formatHelpContext(state, pathname) }),
    messages: [...toModelMessages(history), { role: "user", content: text }],
    tools: {
      send_to_team: tool({
        description:
          "Send the user's suggestion, bug report, comment, or a question you could not answer to the Clozer team. Only after the user agreed to send it.",
        inputSchema: z.object({
          kind: z.enum(FEEDBACK_KINDS),
          summary: z.string().min(3).max(300).describe("One self-contained sentence, in the user's words and language"),
          details: z
            .string()
            .max(2000)
            .optional()
            .describe("Anything that helps the team: steps, what they expected, what happened, why it matters to them"),
        }),
        execute: async (input) => {
          if (!(await canSendFeedback(user.id, now))) return { sent: false, reason: "daily_limit" };
          await saveFeedback({
            ...input,
            organizationId: organization.id,
            userId: user.id,
            pathname,
            user: { name: user.name, email: user.email },
            workspaceName: organization.name,
            role,
            userTexts,
          });
          await prisma.helpMessage.update({ where: { id: question.id }, data: { escalated: true } });
          return { sent: true };
        },
      }),
    },
    stopWhen: isStepCount(3),
    // Sonnet and Haiku 5.5 think first, and the thinking counts against the limit
    maxOutputTokens: 800 + (llm.provider === "anthropic" ? THINKING_ROOM_TOKENS : 0),
    abortSignal: AbortSignal.timeout(45_000),
    onEnd: async ({ steps, totalUsage }) => {
      // Text can come before and after the tool call
      const answer = steps
        .map((step) => step.text.trim())
        .filter(Boolean)
        .join("\n\n");
      await prisma.helpMessage.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "ASSISTANT",
          content: answer,
          model: llm.modelId,
          tokensIn: totalUsage.inputTokens,
          tokensOut: totalUsage.outputTokens,
        },
      });
      await recordAiUsage({
        organizationId: organization.id,
        purpose: "help",
        provider: llm.provider,
        modelId: llm.modelId,
        usage: totalUsage,
        latencyMs: Date.now() - startedAt,
        ok: true,
      });
    },
    onError: async ({ error }) => {
      console.error("[help] stream failed", user.id, error);
      await recordAiUsage({
        organizationId: organization.id,
        purpose: "help",
        provider: llm.provider,
        modelId: llm.modelId,
        latencyMs: Date.now() - startedAt,
        ok: false,
      });
    },
  });

  // Saving the answer must not depend on the user keeping the panel open
  const done = result.consumeStream();
  after(async () => {
    await done;
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
