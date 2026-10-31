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
      fr: "Envoi des emails (liens de connexion, relances, alertes) et réception des réponses des prospects",
      en: "Sending emails (sign-in links, follow-ups, alerts) and receiving prospects' replies",
    },
    location: { fr: "Union européenne (Stockholm)", en: "European Union (Stockholm)" },
    safeguard: { fr: "DPA AWS", en: "AWS DPA" },
  },
  {
    name: "DeepL SE",
    purpose: {
      fr: "Traduction des documents PDF, seulement quand un lecteur demande une autre langue",
      en: "Translation of PDF documents, only when a reader asks for another language",
    },
    location: { fr: "Union européenne (Allemagne)", en: "European Union (Germany)" },
    safeguard: { fr: "DPA DeepL", en: "DeepL DPA" },
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
    name: "Stripe Payments Europe Ltd.",
    purpose: {
      fr: "Paiement des abonnements et facturation",
      en: "Subscription payments and invoicing",
    },
    location: { fr: "Union européenne (Irlande)", en: "European Union (Ireland)" },
    safeguard: { fr: "DPA Stripe, clauses contractuelles types", en: "Stripe DPA, standard contractual clauses" },
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
  {
    name: "Unipile SAS",
    purpose: {
      fr: "Connexion d'une boîte Gmail pour les campagnes de cold email : envoi et lecture des emails de cette boîte, seulement si le vendeur la connecte",
      en: "Connecting a Gmail mailbox for cold email campaigns: sending and reading that mailbox's emails, only if the seller connects it",
    },
    location: { fr: "Union européenne (France)", en: "European Union (France)" },
    safeguard: { fr: "DPA Unipile", en: "Unipile DPA" },
  },
  {
    name: "Microsoft Ireland Operations Ltd.",
    purpose: {
      fr: "Connexion d'une boîte Microsoft 365 pour les campagnes de cold email, seulement si le vendeur la connecte ; les emails restent dans sa boîte",
      en: "Connecting a Microsoft 365 mailbox for cold email campaigns, only if the seller connects it; emails stay in their mailbox",
    },
    location: { fr: "Union européenne (Irlande), selon la région du compte Microsoft", en: "European Union (Ireland), depending on the Microsoft account's region" },
    safeguard: { fr: "DPA Microsoft, clauses contractuelles types", en: "Microsoft DPA, standard contractual clauses" },
  },
  {
    name: "PostHog Inc.",
    purpose: {
      fr: "Mesure d'audience du site et de l'utilisation de l'application, sans cookie (jamais sur les pages de lecture)",
      en: "Audience measurement of the website and of app usage, without cookies (never on reading pages)",
    },
    location: { fr: "Union européenne (Francfort)", en: "European Union (Frankfurt)" },
    safeguard: { fr: "DPA PostHog, clauses contractuelles types", en: "PostHog DPA, standard contractual clauses" },
  },
  {
    name: "Functional Software Inc. (Sentry)",
    purpose: {
      fr: "Détection des erreurs techniques de l'application",
      en: "Detection of technical errors in the application",
    },
    location: { fr: "Union européenne (Francfort)", en: "European Union (Frankfurt)" },
    safeguard: { fr: "DPA Sentry, clauses contractuelles types", en: "Sentry DPA, standard contractual clauses" },
  },
];
