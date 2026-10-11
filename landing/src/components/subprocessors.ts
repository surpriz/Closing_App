// Mirrors what the app actually calls (app/src/lib). Regions to check in each dashboard.
export const SUBPROCESSORS = [
  {
    name: "Vercel Inc.",
    purpose: "Hébergement de l'application, stockage des documents et des enregistrements",
    location: "Union européenne (Paris)",
    safeguard: "DPA Vercel, clauses contractuelles types",
  },
  {
    name: "Neon Inc.",
    purpose: "Base de données",
    location: "Union européenne (Francfort)",
    safeguard: "DPA Neon, clauses contractuelles types",
  },
  {
    name: "Amazon Web Services EMEA SARL",
    purpose: "Envoi des emails (liens de connexion, relances, alertes)",
    location: "Union européenne (Stockholm)",
    safeguard: "DPA AWS",
  },
  {
    name: "Anthropic PBC",
    purpose: "Lecture des documents, assistant de la page de lecture, rédaction des relances, analyse des deals",
    location: "États-Unis",
    safeguard: "DPA Anthropic, Data Privacy Framework ou clauses contractuelles types",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: "Transcription des commentaires vocaux ; IA de secours selon la configuration",
    location: "États-Unis",
    safeguard: "DPA OpenAI, Data Privacy Framework",
  },
  {
    name: "Twilio Inc.",
    purpose: "Relances WhatsApp, seulement si le vendeur les active et que le prospect a accepté",
    location: "États-Unis",
    safeguard: "DPA Twilio, Data Privacy Framework",
  },
  {
    name: "Google LLC",
    purpose: "Connexion avec un compte Google, si l'utilisateur la choisit",
    location: "États-Unis",
    safeguard: "Data Privacy Framework",
  },
];
