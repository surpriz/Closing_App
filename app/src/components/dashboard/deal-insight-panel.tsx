import { ChevronRight, Sparkles } from "lucide-react";

import type { Fact } from "@/lib/closing/brain/facts";
import type { StoredInsight } from "@/lib/closing/brain/latest";
import { formatRelative } from "@/lib/format";
import { cn } from "cn";

import {
  FOLLOWUP_GOAL_LABELS,
  FRICTION_LABELS,
  INSIGHT_ACTION_LABELS,
  MOMENTUM_LABELS,
  STAGE_LABELS,
  TIMING_LABELS,
} from "./labels";
import { Surface } from "./page-header";
import { PrepareFollowupButton } from "./prepare-followup-button";
import { ReanalyzeButton } from "./reanalyze-button";

function reliability(confidence: number) {
  if (confidence < 40) return "faible";
  if (confidence < 70) return "moyenne";
  return "élevée";
}

const SEVERITY_DOT = { low: "bg-foreground/25", medium: "bg-heat-warm", high: "bg-heat-hot" } as const;

/** The fact ids an item rests on, with the fact itself on hover. */
function Sources({ ids, facts }: { ids: string[]; facts: Map<string, Fact> }) {
  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {ids.map((id) => (
        <span
          key={id}
          title={facts.get(id)?.text}
          className="cursor-help rounded bg-muted px-1 text-[11px] text-muted-foreground tabular-nums"
        >
          {id}
        </span>
      ))}
    </span>
  );
}

export function DealInsightPanel({
  linkId,
  insight,
  recipientName,
  aiAvailable,
  draftWaiting,
  readSince,
  now,
}: {
  linkId: string;
  insight: StoredInsight | null;
  recipientName: string | null;
  aiAvailable: boolean;
  /** A follow-up from the analysis already waits in "Relances". */
  draftWaiting: boolean;
  /** The prospect read again after this analysis: it will be refreshed once they stop. */
  readSince: boolean;
  now: Date;
}) {
  if (!insight) {
    return (
      <Surface className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-[15px] text-muted-foreground">
          {aiAvailable
            ? "Pas encore de lecture IA de ce deal. Elle arrive dès que le prospect a lu, ou maintenant :"
            : "La lecture IA des deals demande une clé d'IA configurée."}
        </p>
        {aiAvailable && <ReanalyzeButton linkId={linkId} label="Analyser ce deal" />}
      </Surface>
    );
  }

  const facts = new Map(insight.facts.map((fact) => [fact.id, fact]));
  const action = insight.recommendedAction;
  const brief = insight.followupBrief;

  return (
    <Surface className="overflow-hidden">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-3.5" /> Lecture IA
            </p>
            <p className="text-lg font-medium tracking-[-0.01em]">
              {STAGE_LABELS[insight.stage] ?? insight.stage}
              {insight.byAi && (
                <span className="font-normal text-muted-foreground">
                  , dynamique {MOMENTUM_LABELS[insight.momentum] ?? insight.momentum}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {insight.byAi && (
                <span title="À quel point l'IA est sûre de sa lecture. Peu de signaux = fiabilité faible, même si le prospect est « chaud ».">
                  Fiabilité {reliability(insight.confidence)} ({insight.confidence} %),{" "}
                </span>
              )}
              {insight.byAi ? "analysé " : "mis à jour "}
              {formatRelative(insight.createdAt, now)}
            </span>
            {aiAvailable && <ReanalyzeButton linkId={linkId} />}
          </div>
        </div>

        {readSince && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            Le prospect a relu depuis cette analyse. Clozer la met à jour quelques minutes après la fin de sa lecture,
            ou tout de suite avec « Réanalyser ».
          </p>
        )}

        <div className="space-y-1.5">
          <p className="text-[15px] font-medium">{insight.headline}</p>
          <p className="text-[15px] text-muted-foreground">{insight.summary}</p>
        </div>

        {(insight.signals.length > 0 || insight.frictions.length > 0) && (
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {insight.signals.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">Ce qui compte</p>
                <ul className="space-y-1.5 text-[15px]">
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
                <ul className="space-y-1.5 text-[15px]">
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
      </div>

      <div className="space-y-1.5 border-t border-border bg-muted/40 px-5 py-4">
        {insight.byAi && aiAvailable && (
          <div className="float-right ml-3">
            {draftWaiting ? (
              <a href="#relances" className="text-sm font-medium underline-offset-4 hover:underline">
                Voir la relance prête
              </a>
            ) : (
              <PrepareFollowupButton linkId={linkId} />
            )}
          </div>
        )}
        <p className="text-[15px]">
          <span className="font-medium">
            {INSIGHT_ACTION_LABELS[action.type] ?? action.type}
            {action.type !== "wait" && action.type !== "close_lost" && ` ${TIMING_LABELS[action.timing] ?? ""}`}
          </span>
          {recipientName && action.type !== "wait" && action.type !== "close_lost" && (
            <span className="text-muted-foreground"> : {recipientName}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {action.why}
          {action.factIds.length > 0 && <Sources ids={action.factIds} facts={facts} />}
        </p>
        {brief && (
          <p className="text-sm">
            <span className="font-medium">{FOLLOWUP_GOAL_LABELS[brief.goal] ?? brief.goal}</span> : {brief.angle}
            {brief.topics.length > 0 && <span className="text-muted-foreground"> ({brief.topics.join(", ")})</span>}
          </p>
        )}
      </div>

      {insight.facts.length > 0 && (
        <details className="group border-t border-border px-5 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            Les {insight.facts.length} faits lus par l&apos;IA
          </summary>
          <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
            {insight.facts.map((fact) => (
              <li key={fact.id} className="flex gap-2">
                <span className="w-7 shrink-0 tabular-nums">{fact.id}</span>
                <span className="min-w-0 break-words">{fact.text.replace(/<untrusted_prospect_message>/g, "« ").replace(/<\/untrusted_prospect_message>/g, " »")}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Surface>
  );
}
