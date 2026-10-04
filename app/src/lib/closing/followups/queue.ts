import type { FollowupChannel, FollowupTrigger } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";

import { draftFollowup } from "../ai/generate-followup";
import { DAY_MS } from "../constants";

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
// seller's approval as a DRAFT; in autopilot mode it goes straight to the queue.
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
              pages: {
                select: { pageNumber: true, text: true, tags: true },
                orderBy: { pageNumber: "asc" },
              },
            },
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

  const draft = await draftFollowup({
    trigger: followup.trigger,
    channel: followup.channel,
    locale: followup.locale,
    prospectName: prospect.name,
    company: prospect.company,
    documentName: link.document.name,
    proposalUrl: `${getPublicAppUrl()}/v/${link.slug}`,
    senderName: settings?.senderName ?? link.createdBy?.name ?? null,
    senderSignature: settings?.senderSignature ?? null,
    daysSinceSent: link.sentAt ? Math.floor((Date.now() - link.sentAt.getTime()) / DAY_MS) : null,
    aiTone: settings?.aiTone ?? null,
    documentIntro: pages[0]?.text?.slice(0, 600) ?? null,
    instruction: instruction ?? null,
    pricingExcerpt:
      followup.trigger === "HOT_PRICING"
        ? pages
            .filter((p) => p.tags.includes("PRICING"))
            .map((p) => p.text ?? "")
            .join("\n")
            .slice(0, 1500) || null
        : null,
  });

  // Only move forward if nobody cancelled it while the AI was writing
  await prisma.followup.updateMany({
    where: { id: followupId, status: "PENDING" },
    data: {
      subject: draft.subject,
      body: draft.body,
      aiProvider: draft.aiProvider,
      aiModel: draft.aiModel,
      regenerateInstruction: instruction ?? null,
      status: settings?.autonomy === "AUTOPILOT" ? "GENERATED" : "DRAFT",
    },
  });
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
