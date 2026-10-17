import type { FollowupChannel, FollowupTrigger, PageTag } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { DEFAULT_UI_LOCALE, UI_LOCALES, type UiLocale } from "@/i18n/locale";
import { MESSAGES, type Messages } from "@/i18n/messages";
import { prisma } from "@/lib/db";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { draftFollowup } from "../ai/generate-followup";
import { reviewFollowupWithLlm } from "../ai/guard-llm";
import type { FollowupPromptInput } from "../ai/prompts";
import { notifyDraftReady } from "../alerts/draft-ready";
import { autopilotEligible } from "../brain/policy";
import { DAY_MS } from "../constants";
import { deadlineSourceText, formatDeadline, isLinkExpired } from "../expiry";
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
          createdBy: { select: { name: true, locale: true } },
          organization: { include: { settings: true } },
          document: {
            select: {
              name: true,
              sellerDescription: true,
              docType: true,
              docPurpose: true,
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
  // Issues and reasons are for the seller; the message itself follows the prospect's locale
  const sellerLocale = toUiLocale(link.createdBy?.locale);
  const t = getNamespaceTranslator(sellerLocale, "server.followups");
  const settings = link.organization.settings;
  const pages = link.document.pages;
  const context = (followup.context ?? {}) as { brief?: FollowupPromptInput["brief"]; readTags?: PageTag[] };
  const brief = followup.trigger === "AI_DECISION" ? (context.brief ?? null) : null;
  const now = new Date();
  // The link no longer opens: a message pointing to it would be off-key, and the writer call wasted
  if (isLinkExpired(link, now)) {
    await prisma.followup.updateMany({
      where: { id: followupId, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: now, error: t("dispatch.linkExpired") },
    });
    return;
  }
  const deadlineLabel =
    link.expiresAt && followup.trigger === "EXPIRY_REMINDER"
      ? formatDeadline(link.expiresAt, followup.locale, followup.timezone, { showZone: !prospect.timezone })
      : null;
  // First, so the guard's 6000-character window always holds the real date
  const deadlineSource = link.expiresAt ? `${deadlineSourceText(link.expiresAt, followup.timezone)}\n` : "";
  const sourceText = deadlineSource + guardSourceText({
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
      deadlineLabel,
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
      relevantSections: pickRelevantSections(
        pages,
        brief?.goal ?? null,
        followup.trigger,
        link.document.docType,
        followup.trigger === "WARM_READ" ? context.readTags : undefined,
      ),
      documentPurpose: link.document.docPurpose,
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
      sellerLocale,
    },
  );

  // Autopilot only for messages that need no human eye; a rewrite asked by the seller is always reviewed
  // A shared link's reader typed their address: the seller reads what goes to it
  // "Never opened" is never sent alone: only the seller knows whether the link really went out
  const autopilot =
    settings?.autonomy === "AUTOPILOT" &&
    !instruction &&
    draft.issues.length === 0 &&
    !link.parentLinkId &&
    followup.trigger !== "ANTI_GHOSTING";
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
    const review = await reviewFollowupWithLlm(draft, {
      sourceText,
      organizationId: link.organizationId,
      linkId: link.id,
      locale: sellerLocale,
    });
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
      error: issues.length ? t("queue.toReview", { issues: issues.join(" ") }) : null,
      status: sendsAlone ? "GENERATED" : "DRAFT",
    },
  });
  if (saved.count > 0 && !sendsAlone && !instruction) {
    await notifyDraftReady(link.id, link.organizationId, now);
  }
}

/** Every follow-up still waiting on a link that has expired: it would point to a locked page. */
// One update per seller language: the reason is shown to them
export async function cancelExpiredFollowups(now = new Date()) {
  const where = { status: { in: [...OPEN_FOLLOWUP_STATUSES] }, link: { expiresAt: { lte: now } } };
  const reason = (locale: UiLocale) => getNamespaceTranslator(locale, "server.followups.dispatch")("linkExpired");
  let count = 0;
  // In turn, the catch-all last: it must only get what the others left
  for (const locale of UI_LOCALES) {
    const result = await prisma.followup.updateMany({
      where: { ...where, link: { ...where.link, createdBy: { locale } } },
      data: { status: "CANCELLED", cancelledAt: now, error: reason(locale) },
    });
    count += result.count;
  }
  // No seller left, or a language not handled: the default
  const rest = await prisma.followup.updateMany({
    where,
    data: { status: "CANCELLED", cancelledAt: now, error: reason(DEFAULT_UI_LOCALE) },
  });
  return { count: count + rest.count };
}

type CancelReasonKey = keyof Messages["server"]["followups"]["dispatch"];

function isCancelReasonKey(reason: string): reason is CancelReasonKey {
  return reason in MESSAGES.en.server.followups.dispatch;
}

/**
 * `reason` is shown to the seller on the cancelled follow-ups: pass a key of
 * server.followups.dispatch ("archived", "paused"…) to get it in the language of the
 * seller who sent the link. Any other string is stored as is.
 */
export async function cancelOpenFollowups(linkId: string, reason: CancelReasonKey | (string & {}), triggers?: FollowupTrigger[]) {
  let error: string = reason;
  if (isCancelReasonKey(reason)) {
    const link = await prisma.link.findUnique({ where: { id: linkId }, select: { createdBy: { select: { locale: true } } } });
    error = getNamespaceTranslator(toUiLocale(link?.createdBy?.locale), "server.followups.dispatch")(reason);
  }
  return prisma.followup.updateMany({
    where: {
      linkId,
      status: { in: [...OPEN_FOLLOWUP_STATUSES] },
      ...(triggers ? { trigger: { in: triggers } } : {}),
    },
    data: { status: "CANCELLED", cancelledAt: new Date(), error },
  });
}
