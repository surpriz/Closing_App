import type { AppT } from "./i18n";
import type { NextAction } from "./next-action";

/**
 * The one button at the top of a deal page, from the next action the rules
 * (or the current analysis) chose. Pure: it only says what the button does,
 * the page wires it to what already exists (mark won, follow-ups, logging a call).
 */
export type DealCta =
  | { kind: "mark_won" }
  | { kind: "prepare_followup" }
  | { kind: "copy_link"; label: string }
  | { kind: "href"; label: string; href: string };

export type DealCtaContext = {
  /** Main contact, for mailto: and tel: links. */
  email: string | null;
  phone: string | null;
  /** A follow-up from the analysis already waits in "Relances". */
  draftWaiting: boolean;
  /** "Préparer une relance" needs an AI analysis and a model to write with. */
  canPrepareFollowup: boolean;
  /** What the analysis recommends, for "ai_advice". */
  aiActionType: string | null;
};

/** Anchors of the deal page sections the buttons lead to. */
export const DEAL_ANCHORS = {
  followups: "#relances",
  log: "#noter",
  activity: "#activite",
  reactivate: "#reactiver",
} as const;

export function dealCta(
  action: NextAction,
  ctx: DealCtaContext,
  t: AppT,
): DealCta | null {
  switch (action.kind) {
    case "close_won":
      return { kind: "mark_won" };
    case "call_now":
    case "call":
      return callCta(ctx, t);
    case "reactivate":
      return { kind: "href", label: t("today.dealCta.reactivate"), href: DEAL_ANCHORS.reactivate };
    case "reply":
      return ctx.email
        ? {
            kind: "href",
            label: action.quote ? t("today.dealCta.sendQuote") : t("today.dealCta.reply"),
            href: `mailto:${ctx.email}`,
          }
        : {
            kind: "href",
            label: t("today.dealCta.seeRequest"),
            href: DEAL_ANCHORS.activity,
          };
    case "review_draft":
      return {
        kind: "href",
        label: t("today.dealCta.reviewFollowup"),
        href: DEAL_ANCHORS.followups,
      };
    case "nudge":
      return writeCta(ctx, t);
    case "followup_planned":
      return {
        kind: "href",
        label: t("today.dealCta.seePlanned"),
        href: DEAL_ANCHORS.followups,
      };
    case "meeting_booked":
      return { kind: "href", label: t("today.dealCta.logMeeting"), href: DEAL_ANCHORS.log };
    case "ai_advice":
      if (ctx.draftWaiting)
        return {
          kind: "href",
          label: t("today.dealCta.seeReady"),
          href: DEAL_ANCHORS.followups,
        };
      switch (ctx.aiActionType) {
        case "call":
          return callCta(ctx, t);
        case "send_followup":
        case "involve_decision_maker":
          return writeCta(ctx, t);
        case "reply_to_request":
          return ctx.email
            ? { kind: "href", label: t("today.dealCta.reply"), href: `mailto:${ctx.email}` }
            : {
                kind: "href",
                label: t("today.dealCta.seeRequest"),
                href: DEAL_ANCHORS.activity,
              };
        default:
          return null;
      }
    case "wait":
      // Nobody opened it yet: the useful gesture is sending the link again
      return action.opened
        ? null
        : { kind: "copy_link", label: t("today.dealCta.copyLink") };
    case "in_touch":
    case "campaign":
    case "snoozed":
      return null;
  }
}

function callCta(ctx: DealCtaContext, t: AppT): DealCta {
  return ctx.phone
    ? { kind: "href", label: t("today.dealCta.call"), href: `tel:${ctx.phone}` }
    : { kind: "href", label: t("today.dealCta.logCall"), href: DEAL_ANCHORS.log };
}

function writeCta(ctx: DealCtaContext, t: AppT): DealCta | null {
  if (ctx.draftWaiting)
    return {
      kind: "href",
      label: t("today.dealCta.seeReady"),
      href: DEAL_ANCHORS.followups,
    };
  if (ctx.canPrepareFollowup) return { kind: "prepare_followup" };
  if (ctx.email)
    return {
      kind: "href",
      label: t("today.dealCta.followUpByEmail"),
      href: `mailto:${ctx.email}`,
    };
  return null;
}
