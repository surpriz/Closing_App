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
  /** e.g. "demain à 09:00", already formatted; null when none is planned. */
  nextFollowupLabel: string | null;
};

export type TodayHeadline = { headline: string; hint: string };

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

function hotHint(input: TodayHeadlineInput) {
  const [first] = input.hotProspects;
  return first ? `Appelez ${first} en premier.` : null;
}

export function buildTodayHeadline(input: TodayHeadlineInput): TodayHeadline {
  const hot = input.hotProspects.length;

  if (input.freshValidations.length > 0) {
    const [first] = input.freshValidations;
    const others = input.freshValidations.length - 1;
    return {
      headline:
        others === 0
          ? `${first} a validé.`
          : `${first} et ${others} ${plural(others, "autre", "autres")} ont validé.`,
      hint: hotHint(input) ?? "Préparez la suite pendant que c'est chaud.",
    };
  }

  if (input.changeRequests.length > 0) {
    const [first] = input.changeRequests;
    const count = input.changeRequests.length;
    return {
      headline:
        count === 1
          ? `${first} demande un ajustement.`
          : `${count} prospects demandent un ajustement.`,
      hint: count === 1 ? "Répondez-lui aujourd'hui." : `Commencez par ${first}.`,
    };
  }

  if (hot > 0) {
    return {
      headline:
        hot === 1
          ? `${input.hotProspects[0]} est chaud.`
          : `${hot} prospects sont chauds.`,
      hint: hot === 1 ? "C'est le moment d'appeler." : hotHint(input)!,
    };
  }

  if (input.activeCount === 0) {
    if (input.documentCount === 0) {
      return { headline: "Aucun document pour l'instant.", hint: "Ajoutez un PDF ou un lien pour commencer." };
    }
    return {
      headline: input.documentCount === 1 ? "Votre document est prêt." : "Vos documents sont prêts.",
      hint: "Créez un lien pour l'envoyer à un prospect.",
    };
  }

  const followupHint = input.nextFollowupLabel
    ? `Prochaine relance ${input.nextFollowupLabel}.`
    : "Les relances partent toutes seules.";

  if (input.warmCount > 0) {
    return {
      headline:
        input.warmCount === 1
          ? "Un prospect consulte votre document."
          : `${input.warmCount} prospects consultent vos documents.`,
      hint: `Rien d'urgent. ${followupHint}`,
    };
  }

  if (input.unopenedCount === input.activeCount) {
    return {
      headline:
        input.unopenedCount === 1
          ? "Votre lien n'a pas encore été ouvert."
          : "Aucun lien n'a encore été ouvert.",
      hint: followupHint,
    };
  }

  return { headline: "Rien d'urgent aujourd'hui.", hint: followupHint };
}
