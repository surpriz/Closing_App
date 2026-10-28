import type { FollowupChannel, FollowupTrigger, PageTag } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { quota } from "@/lib/billing/plans";
import { countAiFollowupsThisMonth, getWorkspacePlan } from "@/lib/billing/workspace-plan";
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
import { viewerUrl } from "../link-url";
import { followupUrl } from "./attribution";
import { guardSourceText, pickRelevantSections, previousMessagesOf } from "./writer-context";

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
  /** Set by a native campaign: the follow-up belongs to that enrollment. */
  campaignProspectId?: string;
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
              displayTitle: true,
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
          // A campaign link's history is mostly its fixed steps: the writer must not repeat them
          campaignProspect: {
            select: {
              messages: {
                where: { kind: "STEP", status: "SENT", sentAt: { not: null } },
                orderBy: { sentAt: "desc" },
                take: 3,
                select: { sentAt: true, subject: true, body: true },
              },
            },
          },
          actions: {
            where: { message: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { message: true, createdAt: true },
          },
          // Email replies Clozer caught: the prospect's own words too
          sellerActivities: {
            where: { type: "EMAIL_REPLY_RECEIVED", source: { not: "MANUAL" }, note: { not: null } },
            orderBy: { occurredAt: "desc" },
            take: 2,
            select: { note: true, occurredAt: true },
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
  const context = (followup.context ?? {}) as {
    brief?: FollowupPromptInput["brief"];
    readTags?: PageTag[];
    clicked?: boolean;
    final?: boolean;
  };
  const brief = followup.trigger === "AI_DECISION" ? (context.brief ?? null) : null;
  const now = new Date();
  // Only this follow-up's enrollment: a link's earlier enrollment (re-enrolled contact) is another story
  const campaignSteps =
    followup.campaignProspectId && link.campaignProspectId === followup.campaignProspectId
      ? (link.campaignProspect?.messages ?? [])
      : [];
  // The link no longer opens: a message pointing to it would be off-key, and the writer call wasted
  if (isLinkExpired(link, now)) {
    await prisma.followup.updateMany({
      where: { id: followupId, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: now, error: t("dispatch.linkExpired") },
    });
    return;
  }
  const deadlineLabel =
    link.expiresAt && (followup.trigger === "EXPIRY_REMINDER" || followup.trigger === "INTEREST_RETURNED")
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

  // A campaign link is never "sent" by the seller: its first mail is the enrollment's first step
  let firstSentAt = link.sentAt;
  if (!firstSentAt && followup.campaignProspectId) {
    const first = await prisma.campaignMessage.findFirst({
      where: { enrollmentId: followup.campaignProspectId, status: "SENT", sentAt: { not: null } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });
    firstSentAt = first?.sentAt ?? null;
  }

  // The plan, not the stored setting: autopilot comes back by itself on an upgrade
  const plan = await getWorkspacePlan(link.organizationId);
  const aiQuota =
    plan.limits.aiFollowupsPerMonth === null
      ? null
      : quota(plan.limits.aiFollowupsPerMonth, await countAiFollowupsThisMonth(link.organizationId, now));

  const draft = await draftFollowup(
    {
      trigger: followup.trigger,
      channel: followup.channel,
      locale: followup.locale,
      prospectName: prospect.name,
      company: prospect.company,
      documentName: link.document.name,
      // ?r=: an opening from this message is credited to it
      proposalUrl: followupUrl(viewerUrl(getPublicAppUrl(), { slug: link.slug, document: link.document, company: prospect.company }), followup.id),
      senderName: settings?.senderName ?? link.createdBy?.name ?? null,
      senderSignature: settings?.senderSignature ?? null,
      daysSinceSent: firstSentAt ? Math.floor((now.getTime() - firstSentAt.getTime()) / DAY_MS) : null,
      deadlineLabel,
      sequence:
        followup.trigger === "ANTI_GHOSTING" ? { clicked: !!context.clicked, final: !!context.final } : null,
      aiTone: settings?.aiTone ?? null,
      // Web links have no text: the seller's description stands in for the first page
      documentIntro: (pages[0]?.text ?? link.document.sellerDescription)?.slice(0, 600) ?? null,
      instruction: instruction ?? null,
      pricingExcerpt:
        followup.trigger === "HOT_PRICING" || followup.trigger === "COLD_READ_PRICING"
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
        followup.trigger === "WARM_READ" || followup.trigger === "COLD_READ" ? context.readTags : undefined,
      ),
      documentPurpose: link.document.docPurpose,
      previousFollowups: previousMessagesOf(
        link.followups.map((f) => ({ ...f, sentAt: f.sentAt! })),
        campaignSteps.map((m) => ({ ...m, sentAt: m.sentAt! })),
        now,
      ),
      prospectMessages: [
        ...link.actions.map((a) => a.message!.slice(0, 600)),
        ...link.sellerActivities.map((a) => a.note!.slice(0, 600)),
      ],
    },
    {
      organizationId: link.organizationId,
      linkId: link.id,
      sourceText,
      sellerLocale,
      forceTemplate: aiQuota !== null && !aiQuota.allowed,
    },
  );

  // Autopilot only for messages that need no human eye; a rewrite asked by the seller is always reviewed
  // A shared link's reader typed their address: the seller reads what goes to it
  // "Never opened" is never sent alone: only the seller knows whether the link really went out
  // "Available again" was just asked for by the seller reopening the link: they read it
  const autopilot =
    settings?.autonomy === "AUTOPILOT" &&
    plan.limits.autopilot &&
    !instruction &&
    draft.issues.length === 0 &&
    !link.parentLinkId &&
    followup.trigger !== "ANTI_GHOSTING" &&
    followup.trigger !== "INTEREST_RETURNED" &&
    // A reactivation always goes through the seller
    followup.trigger !== "COLD_REACTIVATE";
  let sendsAlone =
    autopilot &&
    (followup.trigger !== "AI_DECISION" ||
      autopilotEligible({
        now,
        autonomy: settings.autonomy,
        minConfidence: settings.autopilotMinConfidence,
        confidence: followup.confidence ?? 0,
        goal: (brief?.goal ?? null) as Parameters<typeof autopilotEligible>[0]["goal"],
        lastProspectTextAt:
          [link.actions[0]?.createdAt, link.sellerActivities[0]?.occurredAt]
            .filter((at): at is Date => !!at)
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
        guardPassedFirstTry: draft.passedFirstTry && draft.aiProvider !== "template",
        offerDescribed: !!settings.offerDescription,
      }));

  // Nobody reads it before it leaves: a second, model-based check
  const issues = [...draft.issues];
  if (aiQuota && !aiQuota.allowed) issues.push(t("queue.aiQuota", { max: aiQuota.max ?? 0 }));
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
  // The seller is on the deal page and the toast already says it: no "draft ready" alert
  if (saved.count > 0 && !sendsAlone && !instruction && followup.trigger !== "INTEREST_RETURNED") {
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
