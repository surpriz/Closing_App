import { ArrowRight, Mail, Phone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { StoredInsight } from "@/lib/closing/brain/latest";
import type { DealCta } from "@/lib/closing/dashboard/deal-cta";
import {
  describeNextAction,
  isUrgent,
  type NextAction,
} from "@/lib/closing/dashboard/next-action";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CopyButton } from "../copy-button";
import { Sources } from "../deal-verdict";
import { LiveDot } from "../heat";
import { FOLLOWUP_GOAL_LABELS } from "../labels";
import { MarkWonButton } from "../mark-won-button";
import { PrepareFollowupButton } from "../prepare-followup-button";

/**
 * What to do now about this deal, in one sentence, and the one button that
 * does it. The analysis' reasons sit underneath in soft ink.
 */
export function DealNextAction({
  linkId,
  url,
  action,
  cta,
  canEdit,
  insight,
  recipientName,
  signature,
  now,
}: {
  linkId: string;
  url: string;
  action: NextAction;
  cta: DealCta | null;
  canEdit: boolean;
  insight: StoredInsight | null;
  recipientName: string | null;
  /** Who signed and when, once the prospect validated. */
  signature: { by: string; at: Date } | null;
  now: Date;
}) {
  const urgent = isUrgent(action);
  const aiAction = insight?.recommendedAction ?? null;
  const showsRecipient =
    aiAction &&
    aiAction.type !== "wait" &&
    aiAction.type !== "close_lost" &&
    recipientName;
  const brief = insight?.followupBrief ?? null;
  const facts = new Map((insight?.facts ?? []).map((fact) => [fact.id, fact]));
  const sentence =
    action.kind === "close_won" && signature
      ? `${signature.by} a validé ${formatRelative(signature.at, now)}. Confirmez la vente pour arrêter les relances.`
      : describeNextAction(action, now);

  return (
    <div className="flex flex-col gap-4 border-y border-foreground py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 space-y-1.5">
        <p
          className={cn(
            "flex items-start gap-2.5 text-heading",
            !urgent && "font-normal",
          )}
        >
          {action.kind === "call_now" ? (
            <LiveDot className="mt-2 size-2.5 shrink-0" />
          ) : (
            <ArrowRight className="mt-1 size-5 shrink-0" aria-hidden />
          )}
          <span>
            {sentence}
            {showsRecipient && (
              <span className="text-muted-foreground"> {recipientName}</span>
            )}
          </span>
        </p>
        {aiAction && action.kind === "ai_advice" && aiAction.why && (
          <p className="pl-7.5 text-small text-muted-foreground">
            {aiAction.why}
            <Sources ids={aiAction.factIds} facts={facts} />
          </p>
        )}
        {brief && action.kind === "ai_advice" && (
          <p className="pl-7.5 text-small">
            <span className="font-medium">
              {FOLLOWUP_GOAL_LABELS[brief.goal] ?? brief.goal}
            </span>{" "}
            : {brief.angle}
            {brief.topics.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({brief.topics.join(", ")})
              </span>
            )}
          </p>
        )}
      </div>
      {canEdit && cta && (
        <div className="shrink-0 pl-7.5 sm:pl-0">
          <CtaButton cta={cta} linkId={linkId} url={url} />
        </div>
      )}
    </div>
  );
}

function CtaButton({
  cta,
  linkId,
  url,
}: {
  cta: DealCta;
  linkId: string;
  url: string;
}) {
  switch (cta.kind) {
    case "mark_won":
      return <MarkWonButton linkId={linkId} size="lg" />;
    case "prepare_followup":
      return (
        <PrepareFollowupButton linkId={linkId} size="lg" variant="default" />
      );
    case "copy_link":
      return (
        <CopyButton value={url} label={cta.label} size="lg" variant="default" />
      );
    case "href": {
      const Icon = cta.href.startsWith("tel:")
        ? Phone
        : cta.href.startsWith("mailto:")
          ? Mail
          : null;
      return (
        <a href={cta.href} className={buttonVariants({ size: "lg" })}>
          {Icon && <Icon data-icon="inline-start" aria-hidden />}
          {cta.label}
          {!Icon && <ArrowRight data-icon="inline-end" aria-hidden />}
        </a>
      );
    }
  }
}
