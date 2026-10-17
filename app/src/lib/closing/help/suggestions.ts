import type { UiLocale } from "@/i18n/locale";

/**
 * Three starter questions for the page the user opens the assistant on. Pure.
 * Inline rather than in the messages: the help widget (client) calls it.
 */

const BY_PAGE_FR: [prefix: string, questions: string[]][] = [
  [
    "/documents/",
    [
      "Comment envoyer ce document à un prospect ?",
      "À quoi sert l'assistant prospect ?",
      "Comment ajouter un mot d'accueil vidéo ?",
    ],
  ],
  [
    "/documents",
    [
      "Quels documents je peux ajouter ?",
      "Comment envoyer un document à un prospect ?",
      "Un lien par prospect, pourquoi ?",
    ],
  ],
  [
    "/links/",
    [
      "Comment valider ou modifier une relance ?",
      "Que veut dire la température du deal ?",
      "Comment prolonger un lien expiré ?",
    ],
  ],
  [
    "/settings",
    [
      "Copilote ou pilote automatique, je choisis quoi ?",
      "Comment être prévenu sur Slack ?",
      "Comment inviter mon équipe ?",
    ],
  ],
  [
    "/team",
    ["Comment lire la vue équipe ?", "Comment inviter un commercial ?", "Qui peut modifier les deals de l'équipe ?"],
  ],
];

const DEFAULT_FR = [
  "Par où commencer avec Clozer ?",
  "Comment installer l'extension Chrome ou Outlook ?",
  "J'ai une idée pour améliorer Clozer",
];

const BY_PAGE_EN: [prefix: string, questions: string[]][] = [
  [
    "/documents/",
    [
      "How do I send this document to a prospect?",
      "What is the prospect assistant for?",
      "How do I add a video welcome message?",
    ],
  ],
  [
    "/documents",
    ["Which documents can I add?", "How do I send a document to a prospect?", "Why one link per prospect?"],
  ],
  [
    "/links/",
    ["How do I approve or edit a follow-up?", "What does the deal temperature mean?", "How do I extend an expired link?"],
  ],
  [
    "/settings",
    ["Copilot or Autopilot, which one should I pick?", "How do I get alerts in Slack?", "How do I invite my team?"],
  ],
  ["/team", ["How do I read the team view?", "How do I invite a salesperson?", "Who can edit the team's deals?"]],
];

const DEFAULT_EN = [
  "Where do I start with Clozer?",
  "How do I install the Chrome extension or the Outlook add-in?",
  "I have an idea to improve Clozer",
];

export function helpSuggestions(pathname: string | null | undefined, locale: UiLocale = "fr"): string[] {
  const [byPage, fallback] = locale === "en" ? [BY_PAGE_EN, DEFAULT_EN] : [BY_PAGE_FR, DEFAULT_FR];
  if (!pathname) return fallback;
  return byPage.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? fallback;
}
