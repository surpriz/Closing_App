import type { DealStory } from "./facts";
import type { Insight, RawInsight } from "./schema";

/**
 * Keeps only what the model can back with facts. Pure. A claim without a
 * known fact id is dropped, and each drop costs confidence: an analysis that
 * had to be trimmed is less trustworthy than one that was sourced throughout.
 */

const CONFIDENCE_PENALTY_PER_DROP = 8;
const HEADLINE_MAX = 90;
const SUMMARY_MAX = 500;
const TEXT_MAX = 240;

const clip = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

export function validateInsight(raw: RawInsight, story: DealStory): { insight: Insight; dropped: number } {
  const known = new Set(story.facts.map((fact) => fact.id));
  const sourced = (ids: string[]) => {
    const kept = [...new Set(ids.map((id) => id.trim().toUpperCase()))].filter((id) => known.has(id));
    return kept;
  };
  let dropped = 0;

  const signals = raw.signals.flatMap((signal) => {
    const ids = sourced(signal.factIds);
    if (ids.length === 0) {
      dropped++;
      return [];
    }
    return [{ label: clip(signal.label, TEXT_MAX), factIds: ids }];
  });

  const frictions = raw.frictions.flatMap((friction) => {
    const ids = sourced(friction.factIds);
    if (ids.length === 0) {
      dropped++;
      return [];
    }
    return [{ ...friction, detail: clip(friction.detail, TEXT_MAX), factIds: ids }];
  });

  let action = { ...raw.recommendedAction, factIds: sourced(raw.recommendedAction.factIds) };
  if (action.factIds.length === 0 && action.type !== "wait") {
    dropped++;
    action = { ...action, type: "wait", channel: null, timing: "in_2_business_days" };
  }

  // A follow-up needs a brief to write from
  let brief = raw.followupBrief;
  if (action.type === "send_followup" && !brief) {
    dropped++;
    action = { ...action, type: "wait", channel: null };
  }
  if (action.type !== "send_followup") brief = null;

  // Map the reader label to a real contact. An unknown reader can't be written to.
  const label = action.recipient?.trim().toUpperCase().replace(/^LECTEUR\s+/, "") || null;
  const reader = label ? story.readers.find((r) => r.label === label) : undefined;
  const prospectId = reader ? reader.prospectId : story.mainProspectId;
  if (reader && !reader.prospectId && action.type === "send_followup") {
    action = { ...action, type: "involve_decision_maker", channel: null };
    brief = null;
  }

  // Phone actions go through PHONE, written ones never do
  if (action.type === "call" && action.channel !== "PHONE") action = { ...action, channel: "PHONE" };
  if (action.type === "send_followup" && action.channel === "PHONE") action = { ...action, channel: "EMAIL" };

  const confidence = Math.round(Math.max(0, Math.min(100, raw.confidence - dropped * CONFIDENCE_PENALTY_PER_DROP)));
  const priority = Math.round(Math.max(1, Math.min(5, raw.priority)));

  return {
    dropped,
    insight: {
      ...raw,
      stage: story.opened ? raw.stage : "NOT_ENGAGED",
      confidence,
      priority,
      headline: clip(raw.headline, HEADLINE_MAX),
      summary: clip(raw.summary, SUMMARY_MAX),
      signals,
      frictions,
      risks: raw.risks.map((risk) => clip(risk, TEXT_MAX)).filter(Boolean).slice(0, 4),
      recommendedAction: { ...action, why: clip(action.why, TEXT_MAX), prospectId },
      followupBrief: brief && {
        ...brief,
        angle: clip(brief.angle, TEXT_MAX),
        topics: brief.topics.map((t) => clip(t, 80)).slice(0, 4),
        avoid: brief.avoid.map((t) => clip(t, 80)).slice(0, 4),
      },
      scoreNuance: raw.scoreNuance ? clip(raw.scoreNuance, TEXT_MAX) : null,
    },
  };
}
