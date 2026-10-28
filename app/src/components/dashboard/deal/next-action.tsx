import { ArrowRight, Mail, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import type { StoredInsight } from "@/lib/closing/brain/latest";
import type { DealCta } from "@/lib/closing/dashboard/deal-cta";
import {
  describeNextAction,
  isLive,
  isUrgent,
  type NextAction,
} from "@/lib/closing/dashboard/next-action";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CallScriptButton } from "../call-script-button";
import { CopyButton } from "../copy-button";
import { Sources } from "../deal-verdict";
import { LiveDot } from "../heat";
import { MarkWonButton } from "../mark-won-button";
import { PrepareFollowupButton } from "../prepare-followup-button";

/**
 * What to do now about this deal, in one sentence, and the one button that
 * does it. The analysis' reasons sit underneath in soft ink.
 */
export function DealNextAction({
  linkId,
  url,
  shareTitle,
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
  shareTitle: string;
  action: NextAction;
  cta: DealCta | null;
  canEdit: boolean;
  insight: StoredInsight | null;
  recipientName: string | null;
  /** Who signed and when, once the prospect validated. */
  signature: { by: string; at: Date } | null;
  now: Date;
}) {
  const t = useTranslations("deal.nextAction");
  const tl = useTranslations("labels");
  const tRoot = useTranslations();
  const locale = useLocale();
  const urgent = isUrgent(action);
  const aiAction = insight?.recommendedAction ?? null;
  const showsRecipient =
    aiAction &&
    aiAction.type !== "wait" &&
    aiAction.type !== "close_lost" &&
    recipientName;
  const brief = insight?.followupBrief ?? null;
  // A call is the move: the talking points are one click away
  const callAdvised =
    action.kind === "call_now" ||
    action.kind === "call" ||
    (action.kind === "ai_advice" && action.adviceType === "call");
  const facts = new Map((insight?.facts ?? []).map((fact) => [fact.id, fact]));
  const sentence =
    action.kind === "close_won" && signature
      ? t("signed", {
          by: signature.by,
          when: formatRelative(signature.at, locale, now),
        })
      : describeNextAction(action, now, { t: tRoot, locale });

  return (
    <div className="flex flex-col gap-4 border-y border-foreground py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 space-y-1.5">
        <p
          className={cn(
            "flex items-start gap-2.5 text-heading",
            !urgent && "font-normal",
          )}
        >
          {isLive(action) ? (
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
            {t.rich("brief", {
              goal: tl.has(`followupGoal.${brief.goal}` as never)
                ? tl(`followupGoal.${brief.goal}` as never)
                : brief.goal,
              angle: brief.angle,
              b: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
            {brief.topics.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({brief.topics.join(", ")})
              </span>
            )}
          </p>
        )}
        {canEdit && callAdvised && insight?.byAi && (
          <div className="pt-1 pl-7.5">
            <CallScriptButton linkId={linkId} />
          </div>
        )}
      </div>
      {canEdit && cta && (
        <div className="shrink-0 pl-7.5 sm:pl-0">
          <CtaButton cta={cta} linkId={linkId} url={url} shareTitle={shareTitle} />
        </div>
      )}
    </div>
  );
}

function CtaButton({
  cta,
  linkId,
  url,
  shareTitle,
}: {
  cta: DealCta;
  linkId: string;
  url: string;
  shareTitle: string;
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
        <CopyButton value={url} title={shareTitle} label={cta.label} size="lg" variant="default" />
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
