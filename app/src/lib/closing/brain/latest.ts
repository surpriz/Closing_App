import type { DealInsight } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import type { Fact } from "./facts";
import type { Insight } from "./schema";

export type StoredInsight = Insight & { createdAt: Date; facts: Fact[]; byAi: boolean };

/** A stored row back into the shape the UI reads. Json columns were written from these types. */
export function toStoredInsight(row: DealInsight): StoredInsight {
  return {
    stage: row.stage as Insight["stage"],
    momentum: row.momentum as Insight["momentum"],
    confidence: row.confidence,
    priority: row.priority,
    headline: row.headline,
    summary: row.summary,
    signals: row.signals as Insight["signals"],
    frictions: row.frictions as Insight["frictions"],
    risks: row.risks as Insight["risks"],
    recommendedAction: row.recommendedAction as Insight["recommendedAction"],
    followupBrief: (row.followupBrief ?? null) as Insight["followupBrief"],
    scoreNuance: row.scoreNuance,
    createdAt: row.createdAt,
    facts: (row.factsSnapshot as unknown as (Fact & { at: string | null })[]).map((fact) => ({
      ...fact,
      at: fact.at ? new Date(fact.at) : null,
    })),
    byAi: row.model !== null,
  };
}

export async function getLatestInsight(linkId: string) {
  const row = await prisma.dealInsight.findFirst({ where: { linkId }, orderBy: { createdAt: "desc" } });
  return row ? toStoredInsight(row) : null;
}
