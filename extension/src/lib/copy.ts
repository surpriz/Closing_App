// The words the seller reads, once: the popup, the in-page panel, the background
// and the Outlook pane all take them from here (Outlook through the @ext alias).
// Pure: no WXT or Chrome import, so the Outlook event runtime can load it too.
// Outlook notice actions take at most 30 characters, notice messages 150.

export type Locale = "en" | "fr";

/** "fr", "fr-FR", "fr-CA"… → fr; anything else (or nothing) → en. */
export function pickLocale(tag: string | null | undefined): Locale {
  return tag?.trim().toLowerCase().startsWith("fr") ? "fr" : "en";
}

const fr = {
  connect: "Connecter Clozer",
  connectingTitle: "Connexion en cours…",
  connectingText: "Validez dans l'onglet Clozer. Le lien se fera tout seul au retour.",
  connected: (email: string) => `Connecté · ${email}`,
  paused: (host: string) => `Clozer est en pause sur ${host} pour le moment.`,
  updateTitle: "Clozer doit être mis à jour",
  updateText: "Cette version ne fonctionne plus. La mise à jour prend quelques secondes.",
  update: "Mettre à jour",
  updating: "Mise à jour en cours. Rechargez la page dans quelques secondes.",
  updateNotYet: "La mise à jour n'est pas encore arrivée dans Chrome. Réessayez dans quelques minutes.",
  pitch: "Joignez un PDF dans Gmail ou Outlook : Clozer le remplace par un lien.",
  pitchHere: "Joignez un PDF à cet email : Clozer le remplace par un lien.",
  pitchOutlook: "Remplacez le PDF joint à un email par un lien Clozer, et voyez qui consulte vos propositions.",

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
  readingTitle: (labels: string) => `Clozer · en train de lire : ${labels}`,
  nobodyReading: "Personne ne lit vos propositions en ce moment.",
  callMoments: "Me prévenir quand c'est le moment d'appeler",
  callMomentsHint: "Première ouverture, retour après un silence, tarifs, lecture à plusieurs",
  testNotification: "Tester la notification",
  testNotificationTitle: "Clozer est prêt",
  testNotificationText: "C'est ainsi qu'on vous préviendra quand un prospect lit votre proposition.",

  alerts: "Alertes Clozer",
  markWon: "Marquer gagné",
  seeDeal: "Voir le deal",
  seeReading: "Voir la lecture",
  open: "Ouvrir",
  later: "Plus tard",
  dealWon: "Deal gagné",
  dealWonText: "Bravo. Les relances sont arrêtées.",

  insertLink: "Insérer un lien Clozer",
  insertDocument: "Insérer un document",
  searchDocument: "Rechercher un document",
  addPdf: "Ajouter un PDF…",
  noDocument: "Aucun document. Ajoutez un PDF.",
  naming: "Clozer nomme le document…",
  linkInserted: "Lien inséré",
  linkNotCreated: "Lien non créé",
  seeLink: "Voir le lien",
  removeAttachment: "Pensez à retirer la pièce jointe.",
  inThisEmail: "Dans cet email",
  attachedPdfs: "PDF joints",
  clozerLink: "Lien Clozer",
  /** The prospect reads this one, in the email card. */
  viewDocument: "Consulter le document",
  /** Plain-text emails: the title, then the bare URL. */
  plainTextLink: (title: string, url: string) => `${title} : ${url}`,

  preparing: "Préparation…",
  preparingPdf: "Préparation du PDF…",
  readingAttachment: "Lecture de la pièce jointe…",
  uploading: "Envoi du PDF…",
  uploadingPercent: (percent: number) => `Envoi du PDF… ${percent} %`,
  creatingLink: "Création du lien…",
  sendAsLink: (name: string) => `Envoyer « ${name} » en lien ?`,
  sendAsLinkText: "Connectez Clozer pour remplacer la pièce jointe par un lien.",
  replaceQuestion: (name: string, count = 1) => `Remplacer ${count > 1 ? `ces ${count} PDF` : `« ${name} »`} par un lien Clozer ?`,
  notConnected: "Clozer n'est pas connecté",
  notConnectedText: "Connectez votre compte pour insérer vos documents.",

  // Outlook's bar above the email (150 characters at most, cut by the caller)
  connectFirstNotice: (name: string) => `Envoyez « ${name} » en lien Clozer : connectez d'abord Outlook à votre compte.`,
  replacingNotice: (name: string) => `Clozer remplace « ${name} » par un lien…`,
  replacedNotice: (name: string) => `« ${name} » remplacé par un lien Clozer.`,
  failedNotice: (name: string, reason: string) => `Clozer n'a pas pu remplacer « ${name} » : ${reason}`,
  unexpectedReason: "erreur inattendue.",

  // Pairing Outlook with the seller's account
  enterCode: "Dans votre navigateur, connecté à Clozer, saisissez ce code :",
  codeLabel: (code: string) => `Code ${code}`,
  paneUpdates: "Cette fenêtre se met à jour toute seule une fois le code validé.",
  pairingCancelled: "Connexion annulée.",
  codeExpired: "Le code a expiré. Recommencez la connexion.",

  // Errors
  error: "Une erreur est survenue.",
  unexpectedError: "Une erreur inattendue est survenue.",
  connectExtension: "Connectez l'extension à votre compte Clozer.",
  reconnectExtension: "Reconnectez l'extension à votre compte Clozer.",
  connectOutlook: "Connectez Outlook à votre compte Clozer.",
  reconnectOutlook: "Reconnectez Outlook à votre compte Clozer.",
  unreachable: "Clozer est injoignable. Vérifiez votre connexion.",
  serverFailed: "Clozer n'a pas pu traiter la demande.",
  outlookFailed: "Outlook n'a pas pu traiter la demande.",
  extensionNotResponding: "L'extension Clozer ne répond pas. Rechargez la page.",
  uploadTooSlow: "L'envoi prend trop de temps. Réessayez.",
  uploadInterrupted: "L'envoi a été interrompu. Réessayez.",
  uploadIncomplete: "Le PDF n'a pas été reçu en entier. Réessayez.",
  tooLarge: "Ce PDF dépasse 25 Mo.",
  notPdf: "Ce fichier n'est pas un PDF.",
  notReadablePdf: "Ce fichier n'est pas un PDF lisible.",
  unreadableAttachment: "Cette pièce jointe ne peut pas être lue. Ajoutez le PDF depuis le volet Clozer.",
  pdfFailed: "Ce PDF n'a pas pu être préparé. Retirez le lien et ajoutez le document depuis Clozer.",
  insertFailed: (url: string) => `Le lien n'a pas pu être inséré. Copiez-le : ${url}`,

  ignore: "Ignorer",
  close: "Fermer",
  cancel: "Annuler",
  ok: "OK",
  loading: "Chargement…",
};

// Same keys and same signatures as the French: a missing English line fails the typecheck
export type Copy = { readonly [K in keyof typeof fr]: (typeof fr)[K] };

const en: Copy = {
  connect: "Connect Clozer",
  connectingTitle: "Connecting…",
  connectingText: "Confirm in the Clozer tab. You'll be connected as soon as you're back.",
  connected: (email: string) => `Connected · ${email}`,
  paused: (host: string) => `Clozer is paused on ${host} for now.`,
  updateTitle: "Clozer needs an update",
  updateText: "This version no longer works. The update takes a few seconds.",
  update: "Update",
  updating: "Updating. Reload the page in a few seconds.",
  updateNotYet: "The update hasn't reached Chrome yet. Try again in a few minutes.",
  pitch: "Attach a PDF in Gmail or Outlook: Clozer replaces it with a link.",
  pitchHere: "Attach a PDF to this email: Clozer replaces it with a link.",
  pitchOutlook: "Replace the PDF attached to an email with a Clozer link, and see who reads your proposals.",

  settings: "Settings",
  openApp: "Open Clozer",
  workspace: (name: string) => `${name} workspace`,
  disconnect: "Disconnect",
  disconnectConfirm: "Disconnect Clozer from this browser?",
  disconnectConfirmOutlook: "Disconnect Clozer from this Outlook?",

  askFirstLegend: "When I attach a PDF",
  replaceWithLink: "Replace with a link",
  replaceWithLinkHint: "As soon as the PDF is attached, no click.",
  askFirst: "Ask me first",
  askFirstHint: "A button shows up next to the PDF.",

  linkStyleLegend: "Link format",
  card: "Card",
  cardHint: "A framed box with the title",
  plainLink: "Plain link",
  plainLinkHint: "One underlined line",

  readingNow: "Reading now",
  readingTitle: (labels: string) => `Clozer · reading now: ${labels}`,
  nobodyReading: "Nobody is reading your proposals right now.",
  callMoments: "Tell me when it's time to call",
  callMomentsHint: "First open, back after a silence, pricing, several readers",
  testNotification: "Test the notification",
  testNotificationTitle: "Clozer is ready",
  testNotificationText: "This is how you'll hear when a prospect reads your proposal.",

  alerts: "Clozer alerts",
  markWon: "Mark as won",
  seeDeal: "View deal",
  seeReading: "View reading",
  open: "Open",
  later: "Later",
  dealWon: "Deal won",
  dealWonText: "Nice work. Follow-ups are stopped.",

  insertLink: "Insert a Clozer link",
  insertDocument: "Insert a document",
  searchDocument: "Search documents",
  addPdf: "Add a PDF…",
  noDocument: "No documents yet. Add a PDF.",
  naming: "Clozer is naming the document…",
  linkInserted: "Link inserted",
  linkNotCreated: "Link not created",
  seeLink: "View link",
  removeAttachment: "Remember to remove the attachment.",
  inThisEmail: "In this email",
  attachedPdfs: "Attached PDFs",
  clozerLink: "Clozer link",
  viewDocument: "View the document",
  plainTextLink: (title: string, url: string) => `${title}: ${url}`,

  preparing: "Preparing…",
  preparingPdf: "Preparing the PDF…",
  readingAttachment: "Reading the attachment…",
  uploading: "Uploading the PDF…",
  uploadingPercent: (percent: number) => `Uploading the PDF… ${percent}%`,
  creatingLink: "Creating the link…",
  sendAsLink: (name: string) => `Send “${name}” as a link?`,
  sendAsLinkText: "Connect Clozer to replace the attachment with a link.",
  replaceQuestion: (name: string, count = 1) => `Replace ${count > 1 ? `these ${count} PDFs` : `“${name}”`} with a Clozer link?`,
  notConnected: "Clozer isn't connected",
  notConnectedText: "Connect your account to insert your documents.",

  connectFirstNotice: (name: string) => `Send “${name}” as a Clozer link: connect Outlook to your account first.`,
  replacingNotice: (name: string) => `Clozer is replacing “${name}” with a link…`,
  replacedNotice: (name: string) => `“${name}” replaced with a Clozer link.`,
  failedNotice: (name: string, reason: string) => `Clozer couldn't replace “${name}”: ${reason}`,
  unexpectedReason: "unexpected error.",

  enterCode: "In your browser, signed in to Clozer, enter this code:",
  codeLabel: (code: string) => `Code ${code}`,
  paneUpdates: "This pane updates on its own once the code is confirmed.",
  pairingCancelled: "Connection canceled.",
  codeExpired: "The code expired. Start the connection again.",

  error: "Something went wrong.",
  unexpectedError: "An unexpected error occurred.",
  connectExtension: "Connect the extension to your Clozer account.",
  reconnectExtension: "Reconnect the extension to your Clozer account.",
  connectOutlook: "Connect Outlook to your Clozer account.",
  reconnectOutlook: "Reconnect Outlook to your Clozer account.",
  unreachable: "Can't reach Clozer. Check your connection.",
  serverFailed: "Clozer couldn't process the request.",
  outlookFailed: "Outlook couldn't process the request.",
  extensionNotResponding: "The Clozer extension isn't responding. Reload the page.",
  uploadTooSlow: "The upload is taking too long. Try again.",
  uploadInterrupted: "The upload was interrupted. Try again.",
  uploadIncomplete: "The PDF didn't arrive in full. Try again.",
  tooLarge: "This PDF is over 25 MB.",
  notPdf: "This file isn't a PDF.",
  notReadablePdf: "This file isn't a readable PDF.",
  unreadableAttachment: "This attachment can't be read. Add the PDF from the Clozer pane.",
  pdfFailed: "This PDF couldn't be prepared. Remove the link and add the document from Clozer.",
  insertFailed: (url: string) => `The link couldn't be inserted. Copy it: ${url}`,

  ignore: "Dismiss",
  close: "Close",
  cancel: "Cancel",
  ok: "OK",
  loading: "Loading…",
};

export const COPIES: Readonly<Record<Locale, Copy>> = { en, fr };

// typeof, not globalThis: classic Outlook's JavaScript-only runtime may lack both
let current: Locale = pickLocale(typeof navigator !== "undefined" ? navigator.language : undefined);

/**
 * The seller's words in their UI language. A live binding: `COPY.x` always reads
 * the current locale, so callers import it once and never pass a locale around.
 * Starts from navigator.language (popup, content scripts, service worker);
 * Outlook switches it to Office's display language once Office is ready.
 */
export let COPY: Copy = COPIES[current];

export function setLocale(locale: Locale) {
  current = locale;
  COPY = COPIES[locale];
}

/** The locale in use, for Accept-Language and <html lang>. */
export function getLocale(): Locale {
  return current;
}
