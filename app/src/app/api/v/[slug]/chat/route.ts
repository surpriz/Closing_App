import { isStepCount, streamText, tool, toUIMessageStream, createUIMessageStreamResponse } from "ai";
import { cookies } from "next/headers";
import { after, type NextRequest } from "next/server";
import { z } from "zod";

import { getLanguageModel } from "@/lib/closing/ai/provider";
import { recordAiUsage } from "@/lib/closing/ai/usage";
import { canChat } from "@/lib/closing/brain/budget";
import { CHAT_MESSAGE_MAX } from "@/lib/closing/chat/constants";
import { buildChatContext, hasChatKnowledge } from "@/lib/closing/chat/context";
import { escalateQuestion } from "@/lib/closing/chat/escalate";
import { promisesSellerReply } from "@/lib/closing/chat/escalation";
import { lintChatAnswer } from "@/lib/closing/chat/lint";
import { toModelMessages } from "@/lib/closing/chat/messages";
import { buildChatInstructions } from "@/lib/closing/chat/prompts";
import { countRecentQuestions, loadChatHistory, loadChatKnowledge } from "@/lib/closing/chat/queries";
import { decideChatQuota } from "@/lib/closing/chat/quota";
import { SUPPORTED_LOCALES, VIEW_SESSION_WINDOW_MS, type SupportedLocale } from "@/lib/closing/constants";
import { getViewerLabels } from "@/lib/closing/i18n/viewer";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
  viewId: z.string().max(64).nullish(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
});

/**
 * The prospect asks the assistant a question about the proposal. Only the
 * new question comes from the browser: the conversation is read back from
 * the database, so a reader cannot put words in the assistant's mouth.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/chat">) {
  const { slug } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { text, viewId } = parsed.data;
  const locale: SupportedLocale = parsed.data.locale ?? "en";

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY" || !link.chatEnabled) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const access = await getViewerAccess(link);
  if (!access.allowed) return Response.json({ error: "email_required" }, { status: 403 });

  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!visitorId) return Response.json({ error: "no_visitor" }, { status: 403 });

  // The tracked view can still be starting when the first question leaves: fall back to the latest one
  const now = new Date();
  const view =
    (viewId &&
      (await prisma.documentView.findFirst({
        where: { id: viewId, linkId: link.id, visitorId },
        select: { id: true, isBot: true, fromSeller: true },
      }))) ||
    (await prisma.documentView.findFirst({
      where: { linkId: link.id, visitorId, lastSeenAt: { gte: new Date(now.getTime() - VIEW_SESSION_WINDOW_MS) } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, isBot: true, fromSeller: true },
    }));
  if (!view) return Response.json({ error: "no_view" }, { status: 409 });
  // Seller views are flagged isBot too: the seller may test the assistant, crawlers may not
  if (view.isBot && !view.fromSeller) return Response.json({ error: "forbidden" }, { status: 403 });

  const llm = getLanguageModel("chat");
  if (!llm) return Response.json({ error: "unavailable" }, { status: 503 });

  const [counts, workspaceAllowed] = await Promise.all([
    countRecentQuestions({
      linkId: link.id,
      viewId: view.id,
      visitorId,
      ipHash: getRequestContext(request.headers).ipHash,
      now,
    }),
    canChat(link.organizationId, now),
  ]);
  const quotaError = decideChatQuota({ ...counts, workspaceAllowed });
  if (quotaError) return Response.json({ error: quotaError }, { status: 429 });

  const [loaded, history] = await Promise.all([
    loadChatKnowledge({ documentId: link.document.id, organizationId: link.organizationId }),
    loadChatHistory(link.id, visitorId),
  ]);
  if (!loaded || !hasChatKnowledge(loaded.knowledge)) return Response.json({ error: "not_found" }, { status: 404 });

  const labels = getViewerLabels(locale);
  const context = buildChatContext(loaded.knowledge);
  const question = await prisma.chatMessage.create({
    data: { linkId: link.id, viewId: view.id, role: "USER", content: text },
    select: { id: true },
  });
  const userTexts = [...history.filter((m) => m.role === "USER").map((m) => m.content), text];
  let escalated = false;
  const escalate = async (input: { question: string; contactEmail?: string }) => {
    escalated = true;
    return escalateQuestion({
      link,
      view,
      questionRowId: question.id,
      question: input.question,
      contactEmail: input.contactEmail,
      userTexts,
      access,
      now,
    });
  };

  const startedAt = Date.now();
  const result = streamText({
    model: llm.model,
    instructions: buildChatInstructions({
      sender: loaded.senderName ?? labels.chatSenderFallback,
      locale,
      requestChangeLabel: link.ctaEnabled ? labels.requestChange : null,
      docType: loaded.knowledge.document.docType,
      contextText: context.text,
    }),
    messages: [...toModelMessages(history), { role: "user", content: text }],
    tools: {
      escalate_to_seller: tool({
        description:
          "Forward the reader's question to the seller when the documents do not answer it, or when it needs the seller's decision (price negotiation, discount, custom terms, legal or contractual commitment).",
        inputSchema: z.object({
          question: z.string().min(3).max(500).describe("The reader's question, self-contained, in their language"),
          reason: z.enum(["not_in_document", "negotiation", "discount", "legal_commitment", "custom_request", "other"]),
          contactEmail: z
            .string()
            .max(254)
            .optional()
            .describe("Only if the reader typed their email address in this conversation"),
        }),
        execute: async (input) => {
          const outcome = await escalate(input);
          return { forwarded: outcome.forwarded };
        },
      }),
    },
    stopWhen: isStepCount(3),
    maxOutputTokens: 600,
    abortSignal: AbortSignal.timeout(45_000),
    onEnd: async ({ steps, totalUsage }) => {
      // Text can come before and after the tool call
      const answer = steps
        .map((step) => step.text.trim())
        .filter(Boolean)
        .join("\n\n");
      const flags = lintChatAnswer(answer, context.sourceText);
      if (flags.length) console.warn("[chat] answer flagged", link.id, flags);
      await prisma.chatMessage.create({
        data: {
          linkId: link.id,
          viewId: view.id,
          role: "ASSISTANT",
          content: answer,
          model: llm.modelId,
          tokensIn: totalUsage.inputTokens,
          tokensOut: totalUsage.outputTokens,
          flags,
        },
      });
      await recordAiUsage({
        organizationId: link.organizationId,
        linkId: link.id,
        purpose: "chat",
        provider: llm.provider,
        modelId: llm.modelId,
        usage: totalUsage,
        latencyMs: Date.now() - startedAt,
        ok: true,
      });
      // The reader was promised an answer: make sure the seller hears about it
      if (!escalated && promisesSellerReply(answer)) await escalate({ question: text });
    },
    onError: async ({ error }) => {
      console.error("[chat] stream failed", link.id, error);
      await recordAiUsage({
        organizationId: link.organizationId,
        linkId: link.id,
        purpose: "chat",
        provider: llm.provider,
        modelId: llm.modelId,
        latencyMs: Date.now() - startedAt,
        ok: false,
      });
    },
  });

  // Saving the answer must not depend on the reader keeping the tab open
  const done = result.consumeStream();
  after(async () => {
    await done;
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
