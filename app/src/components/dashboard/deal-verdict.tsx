import { ChevronRight, Sparkles } from "lucide-react";

import type { EngagementTier } from "@/generated/prisma/enums";
import type { Fact } from "@/lib/closing/brain/facts";
import type { StoredInsight } from "@/lib/closing/brain/latest";
import { describeNextAction, isUrgent, type NextAction } from "@/lib/closing/dashboard/next-action";
import type { EngagementReason } from "@/lib/closing/types";
import { formatDuration, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { HeatPill, LiveDot } from "./heat";
import {
  FOLLOWUP_GOAL_LABELS,
  FRICTION_LABELS,
  MOMENTUM_LABELS,
  SCORE_REASON_LABELS,
  STAGE_LABELS,
  TIER_LABELS,
} from "./labels";
import { Surface } from "./page-header";
import { PrepareFollowupButton } from "./prepare-followup-button";
import { ReanalyzeButton } from "./reanalyze-button";
import { ScoreGuide, TemperatureGauge } from "./temperature";
import { dealVerdict } from "./verdict";

const SEVERITY_DOT = { low: "bg-foreground/25", medium: "bg-heat-warm", high: "bg-heat-hot" } as const;

const detailsSummary =
  "flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden";

/** The fact ids an item rests on, with the fact itself on hover. */
function Sources({ ids, facts }: { ids: string[]; facts: Map<string, Fact> }) {
  if (ids.length === 0) return null;
  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {ids.map((id) => (
        <span key={id} title={facts.get(id)?.text} className="cursor-help rounded bg-muted px-1 text-micro text-muted-foreground tabular-nums">
          {id}
        </span>
      ))}
    </span>
  );
}

export type DealScore = { tier: EngagementTier; score: number; reasons: EngagementReason[] };

/**
 * The one verdict at the top of a deal: the AI reading when there is one, else
 * the temperature, then what to do. The score's arithmetic and the analysis
 * details wait under two disclosures.
 */
export function DealVerdict({
  linkId,
  insight,
  score,
  opened,
  readingNow,
  lastActivityAt,
  viewCount,
  totalDurationMs,
  action,
  recipientName,
  aiAvailable,
  readSince,
  draftWaiting,
  now,
  scoreGuide,
}: {
  linkId: string;
  insight: StoredInsight | null;
  score: DealScore | null;
  opened: boolean;
  readingNow: boolean;
  lastActivityAt: Date | null;
  viewCount: number;
  totalDurationMs: number;
  /** Same rule as the "À traiter" row: the analysis has the last word, facts of the moment come first. */
  action: NextAction;
  recipientName: string | null;
  aiAvailable: boolean;
  /** The prospect read again after this analysis: it will be refreshed once they stop. */
  readSince: boolean;
  /** A follow-up from the analysis already waits in "Relances". */
  draftWaiting: boolean;
  now: Date;
  scoreGuide: { hasPages: boolean; hasPricing: boolean; pricingThresholdSec: number };
}) {
  const verdict = dealVerdict(
    { insight: insight ? { headline: insight.headline, summary: insight.summary } : null, score, opened },
    { tier: TIER_LABELS, reason: SCORE_REASON_LABELS },
  );
  const facts = new Map((insight?.facts ?? []).map((fact) => [fact.id, fact]));
  const urgent = isUrgent(action);
  const aiAction = insight?.recommendedAction ?? null;
  const showsRecipient = aiAction && aiAction.type !== "wait" && aiAction.type !== "close_lost" && recipientName;
  const brief = insight?.followupBrief ?? null;

  return (
    <Surface className="overflow-hidden">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <HeatPill tier={score?.tier ?? null} />
          {readingNow ? (
            <span className="flex items-center gap-2 font-medium text-foreground">
              <LiveDot /> en lecture
            </span>
          ) : (
            lastActivityAt && <span>lu {formatRelative(lastActivityAt, now)}</span>
          )}
          {viewCount > 0 && (
            <span className="tabular-nums">
              {viewCount} {viewCount === 1 ? "lecture" : "lectures"} · {formatDuration(totalDurationMs)}
            </span>
          )}
          {insight && (
            <span className="flex items-center gap-1">
              <Sparkles className="size-3.5" aria-hidden /> Lecture IA
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-heading text-balance">{verdict.headline}</h2>
          {verdict.detail && <p className="text-body text-muted-foreground">{verdict.detail}</p>}
        </div>

        {readSince && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            Le prospect a relu depuis cette analyse. Clozer la met à jour quelques minutes après la fin de sa lecture,
            ou tout de suite avec « Réanalyser ».
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border bg-muted/40 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "inline-flex max-w-full items-start gap-2 rounded-md px-2 py-1 text-sm",
              urgent ? "bg-foreground text-background" : "bg-muted text-foreground",
            )}
          >
            {action.kind === "call_now" && <LiveDot className="mt-1.5 size-2 shrink-0" />}
            <span>
              {describeNextAction(action, now)}
              {showsRecipient && <span className={urgent ? "opacity-80" : "text-muted-foreground"}> {recipientName}</span>}
            </span>
          </p>
          {aiAction && action.kind === "ai_advice" && (
            <p className="text-sm text-muted-foreground">
              {aiAction.why}
              <Sources ids={aiAction.factIds} facts={facts} />
            </p>
          )}
          {brief && action.kind === "ai_advice" && (
            <p className="text-sm">
              <span className="font-medium">{FOLLOWUP_GOAL_LABELS[brief.goal] ?? brief.goal}</span> : {brief.angle}
              {brief.topics.length > 0 && <span className="text-muted-foreground"> ({brief.topics.join(", ")})</span>}
            </p>
          )}
        </div>
        {aiAvailable && (
          <div className="shrink-0">
            {!insight ? (
              <ReanalyzeButton linkId={linkId} label="Analyser ce deal" />
            ) : draftWaiting ? (
              <a href="#relances" className="text-sm font-medium underline-offset-4 hover:underline">
                Voir la relance prête
              </a>
            ) : insight.byAi ? (
              <PrepareFollowupButton linkId={linkId} />
            ) : null}
          </div>
        )}
      </div>

      <details className="group border-t border-border px-5 py-3">
        <summary className={detailsSummary}>
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
          Pourquoi cette température
        </summary>
        <div className="mt-3 space-y-4">
          {score ? (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-foreground tabular-nums">{score.score}</span> sur 100
              </p>
              <TemperatureGauge tier={score.tier} score={score.score} />
              {score.reasons.length > 0 && (
                <ul className="grid gap-x-8 gap-y-2 text-body sm:grid-cols-2">
                  {score.reasons.map((reason) => (
                    <li key={reason.code} className="flex items-baseline justify-between gap-3">
                      <span>
                        {SCORE_REASON_LABELS[reason.code] ?? reason.code}
                        {reason.detail && <span className="text-muted-foreground"> ({reason.detail})</span>}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">+{reason.weight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-body">Rien encore : la température monte dès que le prospect ouvre son lien et lit.</p>
          )}
          <ScoreGuide {...scoreGuide} />
        </div>
      </details>

      {insight && (
        <details className="group border-t border-border px-5 py-3">
          <summary className={detailsSummary}>
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            Détails de l&apos;analyse
          </summary>
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {insight.byAi ? "Analysée" : "Mise à jour"} {formatRelative(insight.createdAt, now)}
                {insight.byAi && (
                  <span title="À quel point l'IA est sûre de sa lecture. Peu de signaux = confiance faible, même si le prospect est « chaud ».">
                    , sûre à {insight.confidence} %
                  </span>
                )}
                {" · "}
                {STAGE_LABELS[insight.stage] ?? insight.stage}
                {insight.byAi && `, dynamique ${MOMENTUM_LABELS[insight.momentum] ?? insight.momentum}`}
              </span>
              {aiAvailable && <ReanalyzeButton linkId={linkId} />}
            </div>

            {(insight.signals.length > 0 || insight.frictions.length > 0) && (
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {insight.signals.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm text-muted-foreground">Ce qui compte</p>
                    <ul className="space-y-1.5 text-body">
                      {insight.signals.map((signal, i) => (
                        <li key={i}>
                          {signal.label}
                          <Sources ids={signal.factIds} facts={facts} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {insight.frictions.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm text-muted-foreground">Ce qui coince</p>
                    <ul className="space-y-1.5 text-body">
                      {insight.frictions.map((friction, i) => (
                        <li key={i} className="flex gap-2">
                          <span
                            aria-label={`gravité ${friction.severity}`}
                            className={cn("mt-2 size-2 shrink-0 rounded-full", SEVERITY_DOT[friction.severity])}
                          />
                          <span>
                            <span className="font-medium">{FRICTION_LABELS[friction.kind] ?? friction.kind} :</span>{" "}
                            {friction.detail}
                            <Sources ids={friction.factIds} facts={facts} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {insight.risks.length > 0 && (
              <p className="text-sm text-muted-foreground">À surveiller : {insight.risks.join(" · ")}</p>
            )}

            {insight.facts.length > 0 && (
              <details className="group/facts">
                <summary className={detailsSummary}>
                  <ChevronRight className="size-4 transition-transform group-open/facts:rotate-90" />
                  Les {insight.facts.length} faits lus par l&apos;IA
                </summary>
                <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {insight.facts.map((fact) => (
                    <li key={fact.id} className="flex gap-2">
                      <span className="w-7 shrink-0 tabular-nums">{fact.id}</span>
                      <span className="min-w-0 break-words">
                        {fact.text.replace(/<untrusted_prospect_message>/g, "« ").replace(/<\/untrusted_prospect_message>/g, " »")}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </details>
      )}
    </Surface>
  );
}
