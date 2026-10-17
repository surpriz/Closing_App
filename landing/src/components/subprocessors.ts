import type { Locale } from "@/i18n/routing";

type Localized = Record<Locale, string>;

// Mirrors what the app actually calls (app/src/lib). Regions to check in each dashboard.
// French is the version that prevails; keep the English in step.
export const SUBPROCESSORS: { name: string; purpose: Localized; location: Localized; safeguard: Localized }[] = [
  {
    name: "Vercel Inc.",
    purpose: {
      fr: "Hébergement de l'application, stockage des documents et des enregistrements",
      en: "Application hosting, storage of documents and recordings",
    },
    location: { fr: "Union européenne (Paris)", en: "European Union (Paris)" },
    safeguard: { fr: "DPA Vercel, clauses contractuelles types", en: "Vercel DPA, standard contractual clauses" },
  },
  {
    name: "Neon Inc.",
    purpose: { fr: "Base de données", en: "Database" },
    location: { fr: "Union européenne (Francfort)", en: "European Union (Frankfurt)" },
    safeguard: { fr: "DPA Neon, clauses contractuelles types", en: "Neon DPA, standard contractual clauses" },
  },
  {
    name: "Amazon Web Services EMEA SARL",
    purpose: {
      fr: "Envoi des emails (liens de connexion, relances, alertes)",
      en: "Sending emails (sign-in links, follow-ups, alerts)",
    },
    location: { fr: "Union européenne (Stockholm)", en: "European Union (Stockholm)" },
    safeguard: { fr: "DPA AWS", en: "AWS DPA" },
  },
  {
    name: "Anthropic PBC",
    purpose: {
      fr: "Lecture des documents, assistant de la page de lecture, rédaction des relances, analyse des deals",
      en: "Reading documents, assistant on the reading page, drafting follow-ups, deal analysis",
    },
    location: { fr: "États-Unis", en: "United States" },
    safeguard: {
      fr: "DPA Anthropic, Data Privacy Framework ou clauses contractuelles types",
      en: "Anthropic DPA, Data Privacy Framework or standard contractual clauses",
    },
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: {
      fr: "Transcription des commentaires vocaux ; IA de secours selon la configuration",
      en: "Transcription of voice comments; fallback AI depending on configuration",
    },
    location: { fr: "États-Unis", en: "United States" },
    safeguard: { fr: "DPA OpenAI, Data Privacy Framework", en: "OpenAI DPA, Data Privacy Framework" },
  },
  {
    name: "Twilio Inc.",
    purpose: {
      fr: "Relances WhatsApp, seulement si le vendeur les active et que le prospect a accepté",
      en: "WhatsApp follow-ups, only if the seller turns them on and the prospect has agreed",
    },
    location: { fr: "États-Unis", en: "United States" },
    safeguard: { fr: "DPA Twilio, Data Privacy Framework", en: "Twilio DPA, Data Privacy Framework" },
  },
  {
    name: "Google LLC",
    purpose: {
      fr: "Connexion avec un compte Google, si l'utilisateur la choisit",
      en: "Sign-in with a Google account, if the user chooses it",
    },
    location: { fr: "États-Unis", en: "United States" },
    safeguard: { fr: "Data Privacy Framework", en: "Data Privacy Framework" },
  },
];
