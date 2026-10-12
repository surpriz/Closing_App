// The words the seller reads, once: the popup, the in-page panel and the Outlook
// pane all take them from here (Outlook through the @ext alias). Pure: no WXT
// or Chrome import, so the Outlook event runtime can load it too.
// Outlook notice actions take at most 30 characters.
export const COPY = {
  connect: "Connecter Clozer",
  connectingTitle: "Connexion en cours…",
  connectingText: "Validez dans l'onglet Clozer. Le lien se fera tout seul au retour.",
  connected: (email: string) => `Connecté · ${email}`,
  paused: (host: string) => `Clozer est en pause sur ${host} pour le moment.`,
  pitch: "Joignez un PDF dans Gmail ou Outlook : Clozer le remplace par un lien.",
  pitchHere: "Joignez un PDF à cet email : Clozer le remplace par un lien.",

  settings: "Réglages",
  openApp: "Ouvrir Clozer",
  workspace: (name: string) => `Espace ${name}`,
  disconnect: "Déconnecter",
  disconnectConfirm: "Déconnecter Clozer de ce navigateur ?",
  disconnectConfirmOutlook: "Déconnecter Clozer de cet Outlook ?",

  askFirstLegend: "Quand je joins un PDF",
  replaceWithLink: "Remplacer par un lien",
  replaceWithLinkHint: "Dès que le PDF est joint, sans clic.",
  askFirst: "Me demander d'abord",
  askFirstHint: "Un bouton apparaît à côté du PDF.",

  linkStyleLegend: "Format du lien",
  card: "Carte",
  cardHint: "Un encadré avec le titre",
  plainLink: "Lien simple",
  plainLinkHint: "Une ligne soulignée",

  readingNow: "En train de lire",
  nobodyReading: "Personne ne lit vos propositions en ce moment.",
  callMoments: "Me prévenir quand c'est le moment d'appeler",
  callMomentsHint: "Première ouverture, retour après un silence, tarifs, lecture à plusieurs",
  testNotification: "Tester la notification",

  insertDocument: "Insérer un document",
  searchDocument: "Rechercher un document",
  addPdf: "Ajouter un PDF…",
  noDocument: "Aucun document. Ajoutez un PDF.",
  naming: "Clozer nomme le document…",
  linkInserted: "Lien inséré",
  seeLink: "Voir le lien",
  removeAttachment: "Pensez à retirer la pièce jointe.",

  ignore: "Ignorer",
  close: "Fermer",
  cancel: "Annuler",
  loading: "Chargement…",
} as const;
