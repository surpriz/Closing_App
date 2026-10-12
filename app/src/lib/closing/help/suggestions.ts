/** Three starter questions for the page the user opens the assistant on. Pure. */

const BY_PAGE: [prefix: string, questions: string[]][] = [
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
    "/equipe",
    ["Comment lire la vue équipe ?", "Comment inviter un commercial ?", "Qui peut modifier les deals de l'équipe ?"],
  ],
];

const DEFAULT = [
  "Par où commencer avec Clozer ?",
  "Comment installer l'extension Chrome ou Outlook ?",
  "J'ai une idée pour améliorer Clozer",
];

export function helpSuggestions(pathname: string | null | undefined): string[] {
  if (!pathname) return DEFAULT;
  return BY_PAGE.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? DEFAULT;
}
