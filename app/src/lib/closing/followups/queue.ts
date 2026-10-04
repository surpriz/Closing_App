import type { FollowupChannel, FollowupTrigger } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";

import { draftFollowup } from "../ai/generate-followup";
import { reviewFollowupWithLlm } from "../ai/guard-llm";
import type { FollowupPromptInput } from "../ai/prompts";
import { notifyDraftReady } from "../alerts/draft-ready";
import { autopilotEligible } from "../brain/policy";
import { DAY_MS } from "../constants";
import { guardSourceText, pickRelevantSections } from "./writer-context";

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

type QueueFollowupInput = {
  linkId: string;
  prospectId: string;
  trigger: FollowupTrigger;
  channel: FollowupChannel;
  scheduledFor: Date;
  timezone: string;
  locale: string;
  dedupeKey: string;
  context: Record<string, unknown>;
};

// Returns the new follow-up id, or null when the dedupe key already exists
export async function queueFollowup(input: QueueFollowupInput) {
  try {
    const followup = await prisma.followup.create({
      data: { ...input, context: JSON.parse(JSON.stringify(input.context)) },
      select: { id: true },
    });
    return followup.id;
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/** Follow-ups not sent yet and not dropped: what the seller can still act on. */
export const OPEN_FOLLOWUP_STATUSES = ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"] as const;

// Writes the message (AI or template). In copilot mode it then waits for the
// seller's approval as a DRAFT; in autopilot mode it goes straight to the queue
// when it is safe to (see autopilotEligible).
export async function generateFollowupMessage(followupId: string, regenerateInstruction?: string | null) {
  const followup = await prisma.followup.findUnique({
    where: { id: followupId },
    include: {
      prospect: true,
      link: {
        include: {
          createdBy: { select: { name: true } },
          organization: { include: { settings: true } },
          document: {
            select: {
              name: true,
              sellerDescription: true,
              pages: {
                select: { pageNumber: true, text: true, tags: true, summary: true, keyFacts: true },
                orderBy: { pageNumber: "asc" },
              },
            },
          },
          followups: {
            where: { status: { in: ["SENT", "DELIVERED"] }, sentAt: { not: null } },
            orderBy: { sentAt: "desc" },
            take: 3,
            select: { sentAt: true, channel: true, subject: true, body: true },
          },
          actions: {
            where: { message: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { message: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!followup || followup.status !== "PENDING") return;
  const instruction = regenerateInstruction ?? followup.regenerateInstruction;

  const { link, prospect } = followup;
  const settings = link.organization.settings;
  const pages = link.document.pages;
  const context = (followup.context ?? {}) as { brief?: FollowupPromptInput["brief"] };
  const brief = followup.trigger === "AI_DECISION" ? (context.brief ?? null) : null;
  const now = new Date();
  const sourceText = guardSourceText({
    pages,
    sellerDescription: link.document.sellerDescription,
    senderSignature: settings?.senderSignature ?? null,
    offerDescription: settings?.offerDescription ?? null,
    valueProps: settings?.valueProps ?? null,
  });

  const draft = await draftFollowup(
    {
      trigger: followup.trigger,
      channel: followup.channel,
      locale: followup.locale,
      prospectName: prospect.name,
      company: prospect.company,
      documentName: link.document.name,
      proposalUrl: `${getPublicAppUrl()}/v/${link.slug}`,
      senderName: settings?.senderName ?? link.createdBy?.name ?? null,
      senderSignature: settings?.senderSignature ?? null,
      daysSinceSent: link.sentAt ? Math.floor((now.getTime() - link.sentAt.getTime()) / DAY_MS) : null,
      aiTone: settings?.aiTone ?? null,
      // Web links have no text: the seller's description stands in for the first page
      documentIntro: (pages[0]?.text ?? link.document.sellerDescription)?.slice(0, 600) ?? null,
      instruction: instruction ?? null,
      pricingExcerpt:
        followup.trigger === "HOT_PRICING"
          ? pages
              .filter((p) => p.tags.includes("PRICING"))
              .map((p) => p.text ?? "")
              .join("\n")
              .slice(0, 1500) || null
          : null,
      brief,
      offer: { description: settings?.offerDescription ?? null, valueProps: settings?.valueProps ?? null },
      relevantSections: pickRelevantSections(pages, brief?.goal ?? null, followup.trigger),
      previousFollowups: link.followups.map((f) => ({
        daysAgo: Math.floor((now.getTime() - f.sentAt!.getTime()) / DAY_MS),
        channel: f.channel,
        subject: f.subject,
        excerpt: (f.body ?? "").slice(0, 300),
      })),
      prospectMessages: link.actions.map((a) => a.message!.slice(0, 600)),
    },
    {
      organizationId: link.organizationId,
      linkId: link.id,
      sourceText,
    },
  );

  // Autopilot only for messages that need no human eye; a rewrite asked by the seller is always reviewed
  const autopilot = settings?.autonomy === "AUTOPILOT" && !instruction && draft.issues.length === 0;
  let sendsAlone =
    autopilot &&
    (followup.trigger !== "AI_DECISION" ||
      autopilotEligible({
        now,
        autonomy: settings.autonomy,
        minConfidence: settings.autopilotMinConfidence,
        confidence: followup.confidence ?? 0,
        goal: (brief?.goal ?? null) as Parameters<typeof autopilotEligible>[0]["goal"],
        lastProspectTextAt: link.actions[0]?.createdAt ?? null,
        guardPassedFirstTry: draft.passedFirstTry && draft.aiProvider !== "template",
        offerDescribed: !!settings.offerDescription,
      }));

  // Nobody reads it before it leaves: a second, model-based check
  const issues = [...draft.issues];
  if (sendsAlone && draft.aiProvider !== "template") {
    const review = await reviewFollowupWithLlm(draft, { sourceText, organizationId: link.organizationId, linkId: link.id });
    if (!review.ok) {
      sendsAlone = false;
      issues.push(...review.issues);
    }
  }

  // Only move forward if nobody cancelled it while the AI was writing
  const saved = await prisma.followup.updateMany({
    where: { id: followupId, status: "PENDING" },
    data: {
      subject: draft.subject,
      body: draft.body,
      aiProvider: draft.aiProvider,
      aiModel: draft.aiModel,
      regenerateInstruction: instruction ?? null,
      error: issues.length ? `À relire : ${issues.join(" ")}` : null,
      status: sendsAlone ? "GENERATED" : "DRAFT",
    },
  });
  if (saved.count > 0 && !sendsAlone && !instruction) {
    await notifyDraftReady(link.id, link.organizationId, now);
  }
}

export function cancelOpenFollowups(linkId: string, reason: string, triggers?: FollowupTrigger[]) {
  return prisma.followup.updateMany({
    where: {
      linkId,
      status: { in: [...OPEN_FOLLOWUP_STATUSES] },
      ...(triggers ? { trigger: { in: triggers } } : {}),
    },
    data: { status: "CANCELLED", cancelledAt: new Date(), error: reason },
  });
}
