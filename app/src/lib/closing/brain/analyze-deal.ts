import { createHash } from "node:crypto";

import { generateText, Output } from "ai";

import type { InsightTrigger } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { getLanguageModel } from "../ai/provider";
import { recordAiUsage } from "../ai/usage";
import { DAY_MS } from "../constants";
import { actOnInsight } from "./act";
import { canAnalyze } from "./budget";
import { buildDealStory, type DealStory } from "./facts";
import { ANALYZER_SYSTEM_PROMPT, buildAnalyzerPrompt } from "./prompts";
import { loadDealForAnalysis } from "./queries";
import { insightSchema, type Insight } from "./schema";
import { validateInsight } from "./validate";

/** Two analyses of the same deal this close are noise, unless the prospect just acted. */
const COOLDOWN_MS = 20 * 60 * 1000;
const CALL_TIMEOUT_MS = 45_000;
const INSIGHTS_KEPT_PER_LINK = 20;
const ANALYZED_STATUSES = ["OPEN", "CHANGE_REQUESTED"];

export type AnalyzeOutcome =
  | "analyzed"
  | "rules"
  | "unchanged"
  | "cooldown"
  | "budget"
  | "no_ai"
  | "skipped"
  | "failed";

/**
 * Reads one deal and stores what an experienced closer would make of it.
 * Cheap paths first: nothing new, no reading yet, cooldown, budget. The
 * engagement score is left untouched: it stays the measured truth.
 */
export async function analyzeDeal(
  linkId: string,
  trigger: InsightTrigger,
  { force = false, now = new Date() }: { force?: boolean; now?: Date } = {},
): Promise<AnalyzeOutcome> {
  const loaded = await loadDealForAnalysis(linkId, now);
  if (!loaded || loaded.link.archivedAt || !ANALYZED_STATUSES.includes(loaded.link.dealStatus)) {
    if (loaded) await clearDirty(linkId);
    return "skipped";
  }

  const story = buildDealStory(loaded.facts);
  const inputHash = createHash("sha256").update(story.inputHash).update(loaded.link.contextKey).digest("hex");
  const last = await prisma.dealInsight.findFirst({
    where: { linkId },
    orderBy: { createdAt: "desc" },
    select: { inputHash: true, createdAt: true, model: true },
  });

  if (!force && last?.inputHash === inputHash) {
    await clearDirty(linkId);
    return "unchanged";
  }

  // Never opened: no behaviour to read, the rules handle timing
  if (!story.opened) {
    await saveInsight(loaded.link.organizationId, linkId, trigger, inputHash, story, notEngagedInsight(story, loaded.facts.deal.sentAt ?? loaded.facts.deal.createdAt, now), null);
    await clearDirty(linkId);
    return "rules";
  }

  const hardTrigger = trigger === "PROSPECT_ACTION" || trigger === "MANUAL";
  if (!force && !hardTrigger && last?.model && now.getTime() - last.createdAt.getTime() < COOLDOWN_MS) {
    return "cooldown";
  }

  const llm = getLanguageModel("analyze");
  if (!llm) {
    await clearDirty(linkId);
    return "no_ai";
  }
  if (!(await canAnalyze(loaded.link.organizationId, now))) return "budget";

  const startedAt = Date.now();
  try {
    const { output, usage } = await generateText({
      model: llm.model,
      system: ANALYZER_SYSTEM_PROMPT,
      prompt: buildAnalyzerPrompt(loaded.profile, loaded.deal, story.facts),
      output: Output.object({ schema: insightSchema }),
      maxOutputTokens: 1500,
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    await recordAiUsage({
      organizationId: loaded.link.organizationId,
      linkId,
      purpose: "analyze",
      provider: llm.provider,
      modelId: llm.modelId,
      usage,
      latencyMs: Date.now() - startedAt,
      ok: true,
    });

    const { insight } = validateInsight(output, story);
    const insightId = await saveInsight(loaded.link.organizationId, linkId, trigger, inputHash, story, insight, {
      provider: llm.provider,
      model: llm.modelId,
      tokensIn: usage.inputTokens ?? 0,
      tokensOut: usage.outputTokens ?? 0,
    });
    await clearDirty(linkId);
    // The analysis recommends writing: prepare the draft (the policy has the last word)
    if (insight.recommendedAction.type === "send_followup") {
      const acted = await actOnInsight(insightId, { now });
      if (!acted.ok) console.info(`[brain] no follow-up for ${linkId}: ${acted.reasons.join(" ")}`);
    }
    return "analyzed";
  } catch (error) {
    console.error(`[brain] analysis failed for ${linkId}`, error);
    await recordAiUsage({
      organizationId: loaded.link.organizationId,
      linkId,
      purpose: "analyze",
      provider: llm.provider,
      modelId: llm.modelId,
      latencyMs: Date.now() - startedAt,
      ok: false,
    });
    return "failed";
  }
}

function notEngagedInsight(story: DealStory, sentAt: Date, now: Date): Insight {
  const days = Math.floor((now.getTime() - sentAt.getTime()) / DAY_MS);
  return {
    stage: "NOT_ENGAGED",
    momentum: "STEADY",
    confidence: 100,
    priority: days >= 3 ? 3 : 1,
    headline: "Pas encore ouvert.",
    summary:
      "Le prospect n'a pas encore ouvert la proposition. Rien à analyser tant qu'il ne l'a pas lue : les relances de rappel s'en occupent.",
    signals: [],
    frictions: [],
    risks: [],
    recommendedAction: {
      type: "wait",
      channel: null,
      timing: "in_2_business_days",
      recipient: null,
      prospectId: story.mainProspectId,
      why: "Aucune lecture pour l'instant.",
      factIds: story.facts.filter((f) => f.kind === "QUIET").map((f) => f.id),
    },
    followupBrief: null,
    scoreNuance: null,
  };
}

async function saveInsight(
  organizationId: string,
  linkId: string,
  trigger: InsightTrigger,
  inputHash: string,
  story: DealStory,
  insight: Insight,
  llm: { provider: string; model: string; tokensIn: number; tokensOut: number } | null,
) {
  const json = (value: unknown) => JSON.parse(JSON.stringify(value));
  const { id } = await prisma.dealInsight.create({
    data: {
      linkId,
      organizationId,
      trigger,
      inputHash,
      stage: insight.stage,
      momentum: insight.momentum,
      confidence: insight.confidence,
      priority: insight.priority,
      headline: insight.headline,
      summary: insight.summary,
      signals: json(insight.signals),
      frictions: json(insight.frictions),
      risks: json(insight.risks),
      recommendedAction: json(insight.recommendedAction),
      followupBrief: insight.followupBrief ? json(insight.followupBrief) : undefined,
      scoreNuance: insight.scoreNuance,
      factsSnapshot: json(story.facts),
      ...(llm ?? {}),
    },
    select: { id: true },
  });

  // Keep a short history per deal
  const old = await prisma.dealInsight.findMany({
    where: { linkId },
    orderBy: { createdAt: "desc" },
    skip: INSIGHTS_KEPT_PER_LINK,
    select: { id: true },
  });
  if (old.length > 0) await prisma.dealInsight.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  return id;
}

function clearDirty(linkId: string) {
  return prisma.link.update({ where: { id: linkId }, data: { brainDirtyAt: null } });
}

/** Flags a deal for the engine, without a write storm: only the first event since the last analysis writes. */
export function markDealDirty(linkId: string, now = new Date()) {
  return prisma.link.updateMany({ where: { id: linkId, brainDirtyAt: null }, data: { brainDirtyAt: now } });
}

const ENGINE_MAX_ANALYSES = 12;
const ENGINE_PARALLEL = 4;
const ENGINE_TIME_BUDGET_MS = 60_000;
/** A session that ended without its "left" beacon is caught this long after its last flush. */
const DIRTY_GRACE_MS = 10 * 60 * 1000;
/** Deals read in this window get a daily look, so silence is noticed. */
const ACTIVE_WINDOW_MS = 45 * DAY_MS;

/**
 * Engine step: deals flagged by tracking, then deals with no analysis for a
 * day (silence crossing a step). Bounded in count, parallelism and time so
 * the cron request stays well under its limit.
 */
export async function analyzePendingDeals(now = new Date()) {
  if (!getLanguageModel("analyze")) return 0;
  const startedAt = Date.now();
  const open = { archivedAt: null, dealStatus: { in: ["OPEN" as const, "CHANGE_REQUESTED" as const] } };

  const dirty = await prisma.link.findMany({
    where: { ...open, brainDirtyAt: { lte: new Date(now.getTime() - DIRTY_GRACE_MS) } },
    orderBy: { brainDirtyAt: "asc" },
    take: ENGINE_MAX_ANALYSES,
    select: { id: true },
  });
  const stale = await prisma.link.findMany({
    where: {
      ...open,
      id: { notIn: dirty.map((link) => link.id) },
      views: { some: { isBot: false, lastSeenAt: { gte: new Date(now.getTime() - ACTIVE_WINDOW_MS) } } },
      insights: { none: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } } },
    },
    orderBy: { lastActivityAt: "desc" },
    take: ENGINE_MAX_ANALYSES - dirty.length,
    select: { id: true },
  });

  const queue = [
    ...dirty.map((link) => ({ id: link.id, trigger: "SESSION_ENDED" as const })),
    ...stale.map((link) => ({ id: link.id, trigger: "TIME_THRESHOLD" as const })),
  ];
  let analyzed = 0;
  for (let i = 0; i < queue.length; i += ENGINE_PARALLEL) {
    if (Date.now() - startedAt > ENGINE_TIME_BUDGET_MS) break;
    const outcomes = await Promise.all(
      queue.slice(i, i + ENGINE_PARALLEL).map((job) => analyzeDeal(job.id, job.trigger, { now })),
    );
    analyzed += outcomes.filter((outcome) => outcome === "analyzed").length;
  }
  return analyzed;
}
