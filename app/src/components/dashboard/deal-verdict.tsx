import { ChevronRight, Sparkles } from "lucide-react";

import type { EngagementTier } from "@/generated/prisma/enums";
import type { Fact } from "@/lib/closing/brain/facts";
import type { StoredInsight } from "@/lib/closing/brain/latest";
import type { EngagementReason } from "@/lib/closing/types";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { FRICTION_LABELS, MOMENTUM_LABELS, SCORE_REASON_LABELS, STAGE_LABELS, TIER_LABELS } from "./labels";
import { ReanalyzeButton } from "./reanalyze-button";
import { ScoreGuide, TemperatureGauge } from "./temperature";
import { dealVerdict } from "./verdict";
import { tidyEllipsis } from "@/lib/clip-text";

/** How much a friction weighs, in ink only: severity is not a temperature. */
const SEVERITY_SWATCH = { low: "bg-foreground/20", medium: "bg-foreground/55", high: "bg-foreground" } as const;
const SEVERITY_LABELS = { low: "faible", medium: "moyenne", high: "forte" } as const;

const detailsSummary =
  "flex cursor-pointer list-none items-center gap-1.5 py-3 text-small text-muted-foreground outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden";

/** The fact ids an item rests on, with the fact itself on hover. */
export function Sources({ ids, facts }: { ids: string[]; facts: Map<string, Fact> }) {
  if (ids.length === 0) return null;
  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {ids.map((id) => (
        <span
          key={id}
          title={facts.get(id)?.text}
          className="cursor-help rounded-sm bg-muted px-1 font-mono text-micro text-muted-foreground"
        >
          {id}
        </span>
      ))}
    </span>
  );
}

export type DealScore = { tier: EngagementTier; score: number; reasons: EngagementReason[] };

/**
 * The verdict of the deal report: the AI reading when there is one, else what
 * the temperature says. The score's arithmetic and the analysis details wait
 * under two disclosures. What to do about it sits at the top of the page.
 */
export function DealVerdict({
  linkId,
  insight,
  score,
  opened,
  aiAvailable,
  readSince,
  now,
  scoreGuide,
}: {
  linkId: string;
  insight: StoredInsight | null;
  score: DealScore | null;
  opened: boolean;
  aiAvailable: boolean;
  /** The prospect read again after this analysis: it will be refreshed once they stop. */
  readSince: boolean;
  now: Date;
  scoreGuide: { hasPages: boolean; hasPricing: boolean; pricingThresholdSec: number };
}) {
  const verdict = dealVerdict(
    { insight: insight ? { headline: insight.headline, summary: insight.summary } : null, score, opened },
    { tier: TIER_LABELS, reason: SCORE_REASON_LABELS },
  );
  const facts = new Map((insight?.facts ?? []).map((fact) => [fact.id, fact]));

  return (
    <section aria-labelledby="verdict-titre" className="border-t border-foreground">
      <div className="space-y-3 py-4">
        <h2 id="verdict-titre" className="max-w-3xl text-heading text-balance">
          {tidyEllipsis(verdict.headline)}
        </h2>
        {verdict.detail && <p className="max-w-prose text-body text-muted-foreground">{verdict.detail}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-muted-foreground">
          {insight && (
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" aria-hidden />
              Lecture IA, {insight.byAi ? "analysée" : "mise à jour"} {formatRelative(insight.createdAt, now)}
            </span>
          )}
          {aiAvailable && !insight && <ReanalyzeButton linkId={linkId} label="Analyser ce deal" />}
        </div>
        {readSince && (
          <p className="bg-muted px-3 py-2 text-small">
            Le prospect a relu depuis cette analyse. Clozer la met à jour quelques minutes après la fin de sa lecture,
            ou tout de suite avec « Réanalyser ».
          </p>
        )}
      </div>

      <details className="group border-t border-border">
        <summary className={detailsSummary}>
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          Pourquoi cette température
        </summary>
        <div className="space-y-4 pb-4">
          {score ? (
            <>
              <p className="text-small text-muted-foreground">
                <span className="font-mono text-body font-semibold text-foreground">{score.score}</span> sur 100
              </p>
              <TemperatureGauge tier={score.tier} score={score.score} />
              {score.reasons.length > 0 && (
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {score.reasons.map((reason) => (
                    <li
                      key={reason.code}
                      className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-body"
                    >
                      <span>
                        {SCORE_REASON_LABELS[reason.code] ?? reason.code}
                        {reason.detail && <span className="text-muted-foreground"> ({reason.detail})</span>}
                      </span>
                      <span className="font-mono text-small text-muted-foreground">+{reason.weight}</span>
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
        <details className="group border-t border-border">
          <summary className={detailsSummary}>
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            Détails de l&apos;analyse
          </summary>
          <div className="space-y-4 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-small text-muted-foreground">
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
                    <h3 className="mb-1.5 text-small text-muted-foreground">Ce qui compte</h3>
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
                    <h3 className="mb-1.5 text-small text-muted-foreground">Ce qui coince</h3>
                    <ul className="space-y-1.5 text-body">
                      {insight.frictions.map((friction, i) => (
                        <li key={i} className="flex gap-2">
                          <span
                            role="img"
                            aria-label={`gravité ${SEVERITY_LABELS[friction.severity] ?? friction.severity}`}
                            className={cn("mt-2 size-2 shrink-0", SEVERITY_SWATCH[friction.severity])}
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
              <p className="text-small text-muted-foreground">À surveiller : {insight.risks.join(" · ")}</p>
            )}

            {insight.facts.length > 0 && (
              <details className="group/facts">
                <summary className={detailsSummary}>
                  <ChevronRight className="size-4 transition-transform group-open/facts:rotate-90" aria-hidden />
                  Les {insight.facts.length} faits lus par l&apos;IA
                </summary>
                <ol className="space-y-1 text-small text-muted-foreground">
                  {insight.facts.map((fact) => (
                    <li key={fact.id} className="flex gap-2">
                      <span className="w-7 shrink-0 font-mono text-micro leading-[inherit]">{fact.id}</span>
                      <span className="min-w-0 break-words">
                        {fact.text
                          .replace(/<untrusted_prospect_message>/g, "« ")
                          .replace(/<\/untrusted_prospect_message>/g, " »")}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
