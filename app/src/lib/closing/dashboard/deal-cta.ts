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
} as const;

export function dealCta(
  action: NextAction,
  ctx: DealCtaContext,
): DealCta | null {
  switch (action.kind) {
    case "close_won":
      return { kind: "mark_won" };
    case "call_now":
    case "call":
      return callCta(ctx);
    case "reply":
      return ctx.email
        ? {
            kind: "href",
            label: action.quote ? "Envoyer le devis" : "Répondre",
            href: `mailto:${ctx.email}`,
          }
        : {
            kind: "href",
            label: "Voir sa demande",
            href: DEAL_ANCHORS.activity,
          };
    case "review_draft":
      return {
        kind: "href",
        label: "Relire la relance",
        href: DEAL_ANCHORS.followups,
      };
    case "nudge":
      return writeCta(ctx);
    case "followup_planned":
      return {
        kind: "href",
        label: "Voir la relance prévue",
        href: DEAL_ANCHORS.followups,
      };
    case "meeting_booked":
      return { kind: "href", label: "Noter l'échange", href: DEAL_ANCHORS.log };
    case "ai_advice":
      if (ctx.draftWaiting)
        return {
          kind: "href",
          label: "Voir la relance prête",
          href: DEAL_ANCHORS.followups,
        };
      switch (ctx.aiActionType) {
        case "call":
          return callCta(ctx);
        case "send_followup":
        case "involve_decision_maker":
          return writeCta(ctx);
        case "reply_to_request":
          return ctx.email
            ? { kind: "href", label: "Répondre", href: `mailto:${ctx.email}` }
            : {
                kind: "href",
                label: "Voir sa demande",
                href: DEAL_ANCHORS.activity,
              };
        default:
          return null;
      }
    case "wait":
      // Nobody opened it yet: the useful gesture is sending the link again
      return action.opened
        ? null
        : { kind: "copy_link", label: "Copier le lien" };
    case "in_touch":
    case "snoozed":
      return null;
  }
}

function callCta(ctx: DealCtaContext): DealCta {
  return ctx.phone
    ? { kind: "href", label: "Appeler", href: `tel:${ctx.phone}` }
    : { kind: "href", label: "Noter l'appel", href: DEAL_ANCHORS.log };
}

function writeCta(ctx: DealCtaContext): DealCta | null {
  if (ctx.draftWaiting)
    return {
      kind: "href",
      label: "Voir la relance prête",
      href: DEAL_ANCHORS.followups,
    };
  if (ctx.canPrepareFollowup) return { kind: "prepare_followup" };
  if (ctx.email)
    return {
      kind: "href",
      label: "Relancer par email",
      href: `mailto:${ctx.email}`,
    };
  return null;
}
