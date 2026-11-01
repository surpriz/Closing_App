import type { AppT } from "@/lib/closing/dashboard/i18n";

/**
 * The sentence at the top of the "Aujourd'hui" page: what matters most right
 * now, then what to do about it. Pure so every branch is tested.
 */

export type TodayHeadlineInput = {
  /** Open deals, hottest first. */
  hotProspects: string[];
  warmCount: number;
  /** Prospects who asked for a change and are still waiting for an answer. */
  changeRequests: string[];
  /** Prospects who validated in the last 24 hours. */
  freshValidations: string[];
  activeCount: number;
  /** Documents added (PDFs and web links), with or without prospect links. */
  documentCount: number;
  /** Active links never opened. */
  unopenedCount: number;
  /** e.g. "demain à 09:00", already formatted in the UI locale; null when none is planned. */
  nextFollowupLabel: string | null;
  /** The deal the analysis ranks most urgent (priority 4 or 5), with its one-line reading. */
  aiFocus?: { label: string; headline: string } | null;
  /** Follow-ups written and waiting for the seller's approval. */
  draftsToReview?: number;
  /** Links created on drop and not sent yet, with the latest one's document. */
  readyLinks?: { count: number; documentName: string } | null;
  /** At least one open deal has Clozer's follow-ups on: false means the seller follows up alone. */
  followupsOn?: boolean;
};

export type TodayHeadline = { headline: string; hint: string };

/**
 * The label in front of the analysis headline: "Waltio · Thomas · Thomas se dit intéressé" says the
 * name twice, so when the headline opens with the person, the label keeps the company alone.
 */
export function focusLabel(input: { label: string; company: string | null; headline: string }): string {
  const person = input.label.split(" · ").slice(1).join(" · ").trim();
  if (!input.company || !person) return input.label;
  return input.headline.trim().toLowerCase().startsWith(person.toLowerCase()) ? input.company : input.label;
}

function draftsHint(t: AppT, input: TodayHeadlineInput) {
  const drafts = input.draftsToReview ?? 0;
  if (drafts === 0) return null;
  return t("today.headline.drafts", { count: drafts });
}

function hotHint(t: AppT, input: TodayHeadlineInput) {
  const [first] = input.hotProspects;
  return first ? t("today.headline.callFirst", { name: first }) : null;
}

export function buildTodayHeadline(t: AppT, input: TodayHeadlineInput): TodayHeadline {
  const hot = input.hotProspects.length;

  if (input.freshValidations.length > 0) {
    const [first] = input.freshValidations;
    const others = input.freshValidations.length - 1;
    return {
      headline:
        others === 0
          ? t("today.headline.validatedOne", { name: first })
          : t("today.headline.validatedMany", { name: first, others }),
      hint: hotHint(t, input) ?? t("today.headline.validatedHint"),
    };
  }

  if (input.changeRequests.length > 0) {
    const [first] = input.changeRequests;
    const count = input.changeRequests.length;
    return {
      headline:
        count === 1
          ? t("today.headline.changeOne", { name: first })
          : t("today.headline.changeMany", { count }),
      hint: count === 1 ? t("today.headline.changeOneHint") : t("today.headline.changeManyHint", { name: first }),
    };
  }

  if (input.aiFocus) {
    // The analysis wrote a sentence, often starting with a first name: shown as written
    const drafts = input.draftsToReview ?? 0;
    return {
      headline: t("today.headline.aiFocus", { label: input.aiFocus.label, headline: input.aiFocus.headline }),
      hint: drafts > 0 ? t("today.headline.draftsNext", { count: drafts }) : t("today.headline.startThere"),
    };
  }

  if (hot > 0) {
    return {
      headline:
        hot === 1
          ? t("today.headline.hotOne", { name: input.hotProspects[0] })
          : t("today.headline.hotMany", { count: hot }),
      hint: hot === 1 ? t("today.headline.hotOneHint") : hotHint(t, input)!,
    };
  }

  if (input.activeCount === 0) {
    if (input.documentCount === 0) {
      return { headline: t("today.headline.noDocument"), hint: t("today.headline.noDocumentHint") };
    }
    const ready = input.readyLinks;
    if (ready && ready.count === 1) {
      return {
        headline: t("today.headline.readyOne"),
        hint: t("today.headline.readyOneHint", { name: ready.documentName }),
      };
    }
    if (ready && ready.count > 1) {
      return {
        headline: t("today.headline.readyMany", { count: ready.count }),
        hint: t("today.headline.readyManyHint"),
      };
    }
    return {
      headline:
        input.documentCount === 1 ? t("today.headline.documentReadyOne") : t("today.headline.documentReadyMany"),
      hint: t("today.headline.createLinkHint"),
    };
  }

  const followupHint =
    draftsHint(t, input) ??
    (input.nextFollowupLabel
      ? t("today.headline.nextFollowup", { when: input.nextFollowupLabel })
      : input.followupsOn === false
        ? t("today.headline.noFollowups")
        : t("today.headline.autoFollowups"));

  if (input.warmCount > 0) {
    return {
      headline:
        input.warmCount === 1
          ? t("today.headline.warmOne")
          : t("today.headline.warmMany", { count: input.warmCount }),
      hint: t("today.headline.nothingUrgent", { hint: followupHint }),
    };
  }

  if (input.unopenedCount === input.activeCount) {
    return {
      headline:
        input.unopenedCount === 1 ? t("today.headline.unopenedOne") : t("today.headline.unopenedAll"),
      hint: followupHint,
    };
  }

  return { headline: t("today.headline.quietDay"), hint: followupHint };
}
