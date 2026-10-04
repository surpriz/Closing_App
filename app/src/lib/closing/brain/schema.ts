import { z } from "zod";

/**
 * What the deal analysis returns. Enums everywhere a decision is made, so
 * the output can be checked; free text only for what the seller reads.
 * Every field is required (nullable rather than optional): OpenAI structured
 * output rejects optional fields.
 */

export const STAGES = [
  "NOT_ENGAGED",
  "DISCOVERING",
  "EVALUATING",
  "NEGOTIATING",
  "DECIDING",
  "STALLED",
  "LIKELY_LOST",
] as const;
export const MOMENTUMS = ["RISING", "STEADY", "COOLING"] as const;
export const FRICTION_KINDS = [
  "PRICE",
  "SCOPE",
  "TIMING",
  "DECISION_MAKER",
  "COMPETITION",
  "TRUST",
  "STALLED_AT_SECTION",
  "OTHER",
] as const;
export const ACTION_TYPES = [
  "send_followup",
  "call",
  "reply_to_request",
  "involve_decision_maker",
  "wait",
  "close_lost",
] as const;
export const ACTION_CHANNELS = ["EMAIL", "WHATSAPP", "PHONE"] as const;
export const TIMINGS = ["now", "next_business_morning", "in_2_business_days", "in_1_week", "before_deadline"] as const;
export const FOLLOWUP_GOALS = [
  "gentle_reminder",
  "clarify_pricing",
  "propose_call",
  "address_objection",
  "share_case_study",
  "involve_decision_maker",
  "reactivate",
] as const;

const factIds = z.array(z.string());

// No numeric bounds here: providers drop them from the schema they enforce, so
// a 105 would fail parsing and lose the whole analysis. validate.ts clamps.
export const insightSchema = z.object({
  stage: z.enum(STAGES),
  momentum: z.enum(MOMENTUMS),
  /** 0-100 */
  confidence: z.number(),
  /** 1 (can wait) - 5 (act today) */
  priority: z.number(),
  headline: z.string(),
  summary: z.string(),
  signals: z.array(z.object({ label: z.string(), factIds })),
  frictions: z.array(
    z.object({
      kind: z.enum(FRICTION_KINDS),
      detail: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      factIds,
    }),
  ),
  risks: z.array(z.string()),
  recommendedAction: z.object({
    type: z.enum(ACTION_TYPES),
    channel: z.enum(ACTION_CHANNELS).nullable(),
    timing: z.enum(TIMINGS),
    /** A reader label ("A", "B"…), or null for the main contact. */
    recipient: z.string().nullable(),
    why: z.string(),
    factIds,
  }),
  followupBrief: z
    .object({
      goal: z.enum(FOLLOWUP_GOALS),
      angle: z.string(),
      topics: z.array(z.string()),
      avoid: z.array(z.string()),
    })
    .nullable(),
  scoreNuance: z.string().nullable(),
});

export type RawInsight = z.infer<typeof insightSchema>;

export type Insight = Omit<RawInsight, "recommendedAction"> & {
  recommendedAction: RawInsight["recommendedAction"] & { prospectId: string | null };
};
