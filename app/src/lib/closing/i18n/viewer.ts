import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/closing/constants";

export type ViewerLabels = {
  loading: string;
  loadError: string;
  processing: string;
  unavailable: string;
  page: string;
  of: string;
  validate: string;
  validated: string;
  confirmValidate: string;
  requestChange: string;
  changeRequested: string;
  changePlaceholder: string;
  send: string;
  cancel: string;
  actionError: string;
  emailTitle: string;
  emailDescription: string;
  emailLabel: string;
  nameLabel: string;
  emailSubmit: string;
  invalidEmail: string;
  privacyNotice: string;
  privacyNoticeWeb: string;
  privacyLink: string;
  openExternal: string;
  externalTitle: string;
  externalDescription: string;
  sharedBy: string;
  readyPrompt: string;
  confirmTitle: string;
  confirmAction: string;
  validatedNext: string;
  changeTitle: string;
  notFoundTitle: string;
  notFoundText: string;
  /** Assistant on the document. {sender} is replaced by the sender's name. */
  chatLauncher: string;
  chatTitle: string;
  chatIntro: string;
  chatPlaceholder: string;
  chatClose: string;
  chatThinking: string;
  chatDisclaimer: string;
  chatForwarded: string;
  chatError: string;
  chatLimit: string;
  chatSenderFallback: string;
  chatSuggestScope: string;
  chatSuggestPricing: string;
  chatSuggestTiming: string;
  chatSuggestTerms: string;
  chatSuggestSummary: string;
  chatSuggestNext: string;
};

const LABELS: Record<"en" | "fr" | "es" | "de", ViewerLabels> = {
  en: {
    loading: "Loading the document…",
    loadError: "The document could not be loaded. Please refresh the page.",
    processing: "This document is being prepared. Please come back in a moment.",
    unavailable: "This document can't be displayed. Please ask the sender for a new link.",
    page: "Page",
    of: "of",
    validate: "Accept & sign",
    validated: "Proposal accepted, thank you!",
    confirmValidate: "Confirm that you accept this proposal?",
    requestChange: "Request a change",
    changeRequested: "Your request has been sent.",
    changePlaceholder: "What would you like to adjust?",
    send: "Send",
    cancel: "Cancel",
    actionError: "Something went wrong, please try again.",
    emailTitle: "Access the document",
    emailDescription: "Enter your email to view this document.",
    emailLabel: "Work email",
    nameLabel: "Name (optional)",
    emailSubmit: "View the document",
    invalidEmail: "Please enter a valid email address.",
    privacyNotice: "The sender can see which pages of this document are viewed and for how long, to follow up at the right time.",
    privacyNoticeWeb: "The sender can see when this document is opened and for how long, to follow up at the right time.",
    privacyLink: "Privacy",
    openExternal: "Open in a new tab",
    externalTitle: "This document opens on its own site",
    externalDescription: "It cannot be displayed here. Open it in a new tab, then come back to reply.",
    sharedBy: "Shared by",
    readyPrompt: "Ready to move forward?",
    confirmTitle: "Accept this proposal",
    confirmAction: "Yes, I accept",
    validatedNext: "The sender has been notified and will be in touch shortly.",
    changeTitle: "What would you like to change?",
    notFoundTitle: "This link is no longer available",
    notFoundText: "It may have expired or been withdrawn. Ask the sender for a new link.",
    chatLauncher: "Ask a question",
    chatTitle: "Questions about this proposal",
    chatIntro: "Hi! I can answer your questions about this document while {sender} is away.",
    chatPlaceholder: "Ask about the scope, prices, conditions…",
    chatClose: "Close",
    chatThinking: "Writing…",
    chatDisclaimer: "Automatic answers based on this document only. {sender} can read this conversation.",
    chatForwarded: "Question passed on to {sender}",
    chatError: "The assistant is unavailable, please try again in a moment.",
    chatLimit: "You've reached the question limit for now. {sender} will be happy to answer directly.",
    chatSenderFallback: "the sender",
    chatSuggestScope: "What exactly is included?",
    chatSuggestPricing: "How does payment work?",
    chatSuggestTiming: "What is the timeline?",
    chatSuggestTerms: "What are the conditions?",
    chatSuggestSummary: "Can you sum up this proposal?",
    chatSuggestNext: "What are the next steps?",
  },
  fr: {
    loading: "Chargement du document…",
    loadError: "Impossible de charger le document. Rechargez la page.",
    processing: "Ce document est en cours de préparation. Revenez dans un instant.",
    unavailable: "Ce document ne peut pas être affiché. Demandez un nouveau lien à l'expéditeur.",
    page: "Page",
    of: "sur",
    validate: "Valider & signer",
    validated: "Proposition validée, merci !",
    confirmValidate: "Confirmez-vous valider cette proposition ?",
    requestChange: "Demander un ajustement",
    changeRequested: "Votre demande a bien été envoyée.",
    changePlaceholder: "Que souhaitez-vous ajuster ?",
    send: "Envoyer",
    cancel: "Annuler",
    actionError: "Une erreur est survenue, réessayez.",
    emailTitle: "Accéder au document",
    emailDescription: "Indiquez votre email pour consulter ce document.",
    emailLabel: "Email professionnel",
    nameLabel: "Nom (facultatif)",
    emailSubmit: "Voir le document",
    invalidEmail: "Adresse email invalide.",
    privacyNotice: "L'expéditeur voit quelles pages de ce document sont consultées et combien de temps, pour vous recontacter au bon moment.",
    privacyNoticeWeb: "L'expéditeur voit quand ce document est ouvert et combien de temps, pour vous recontacter au bon moment.",
    privacyLink: "Confidentialité",
    openExternal: "Ouvrir dans un nouvel onglet",
    externalTitle: "Ce document s'ouvre sur son propre site",
    externalDescription: "Il ne peut pas s'afficher ici. Ouvrez-le dans un nouvel onglet, puis revenez pour répondre.",
    sharedBy: "Envoyé par",
    readyPrompt: "Prêt à avancer ?",
    confirmTitle: "Valider cette proposition",
    confirmAction: "Oui, je valide",
    validatedNext: "L'expéditeur est prévenu et revient vers vous rapidement.",
    changeTitle: "Que souhaitez-vous ajuster ?",
    notFoundTitle: "Ce lien n'est plus disponible",
    notFoundText: "Il a peut-être expiré ou été retiré. Demandez un nouveau lien à l'expéditeur.",
    chatLauncher: "Poser une question",
    chatTitle: "Une question sur cette proposition ?",
    chatIntro: "Bonjour ! Je peux répondre à vos questions sur ce document en l'absence de {sender}.",
    chatPlaceholder: "Périmètre, prix, conditions…",
    chatClose: "Fermer",
    chatThinking: "Rédaction…",
    chatDisclaimer: "Réponses automatiques basées uniquement sur ce document. {sender} peut lire cette conversation.",
    chatForwarded: "Question transmise à {sender}",
    chatError: "L'assistant est indisponible, réessayez dans un instant.",
    chatLimit: "Vous avez atteint la limite de questions pour le moment. {sender} vous répondra volontiers directement.",
    chatSenderFallback: "l'expéditeur",
    chatSuggestScope: "Qu'est-ce qui est inclus exactement ?",
    chatSuggestPricing: "Comment se passe le paiement ?",
    chatSuggestTiming: "Quel est le calendrier ?",
    chatSuggestTerms: "Quelles sont les conditions ?",
    chatSuggestSummary: "Pouvez-vous résumer cette proposition ?",
    chatSuggestNext: "Quelles sont les prochaines étapes ?",
  },
  es: {
    loading: "Cargando el documento…",
    loadError: "No se pudo cargar el documento. Recarga la página.",
    processing: "Este documento se está preparando. Vuelve en un momento.",
    unavailable: "Este documento no se puede mostrar. Pide un nuevo enlace al remitente.",
    page: "Página",
    of: "de",
    validate: "Aceptar y firmar",
    validated: "Propuesta aceptada, ¡gracias!",
    confirmValidate: "¿Confirmas que aceptas esta propuesta?",
    requestChange: "Solicitar un ajuste",
    changeRequested: "Tu solicitud ha sido enviada.",
    changePlaceholder: "¿Qué te gustaría ajustar?",
    send: "Enviar",
    cancel: "Cancelar",
    actionError: "Algo salió mal, inténtalo de nuevo.",
    emailTitle: "Acceder al documento",
    emailDescription: "Introduce tu email para ver este documento.",
    emailLabel: "Email profesional",
    nameLabel: "Nombre (opcional)",
    emailSubmit: "Ver el documento",
    invalidEmail: "Introduce un email válido.",
    privacyNotice: "El remitente puede ver qué páginas de este documento se consultan y durante cuánto tiempo, para contactarte en el momento adecuado.",
    privacyNoticeWeb: "El remitente puede ver cuándo se abre este documento y durante cuánto tiempo, para contactarte en el momento adecuado.",
    privacyLink: "Privacidad",
    openExternal: "Abrir en una pestaña nueva",
    externalTitle: "Este documento se abre en su propio sitio",
    externalDescription: "No se puede mostrar aquí. Ábrelo en una pestaña nueva y vuelve para responder.",
    sharedBy: "Enviado por",
    readyPrompt: "¿Listo para avanzar?",
    confirmTitle: "Aceptar esta propuesta",
    confirmAction: "Sí, acepto",
    validatedNext: "El remitente ha sido avisado y te contactará en breve.",
    changeTitle: "¿Qué te gustaría ajustar?",
    notFoundTitle: "Este enlace ya no está disponible",
    notFoundText: "Puede haber caducado o haber sido retirado. Pide un nuevo enlace al remitente.",
    chatLauncher: "Hacer una pregunta",
    chatTitle: "¿Preguntas sobre esta propuesta?",
    chatIntro: "¡Hola! Puedo responder a sus preguntas sobre este documento mientras {sender} no está disponible.",
    chatPlaceholder: "Alcance, precios, condiciones…",
    chatClose: "Cerrar",
    chatThinking: "Escribiendo…",
    chatDisclaimer: "Respuestas automáticas basadas solo en este documento. {sender} puede leer esta conversación.",
    chatForwarded: "Pregunta enviada a {sender}",
    chatError: "El asistente no está disponible, inténtelo de nuevo en un momento.",
    chatLimit: "Ha alcanzado el límite de preguntas por ahora. {sender} le responderá con gusto directamente.",
    chatSenderFallback: "el remitente",
    chatSuggestScope: "¿Qué incluye exactamente?",
    chatSuggestPricing: "¿Cómo funciona el pago?",
    chatSuggestTiming: "¿Cuál es el calendario?",
    chatSuggestTerms: "¿Cuáles son las condiciones?",
    chatSuggestSummary: "¿Puede resumir esta propuesta?",
    chatSuggestNext: "¿Cuáles son los próximos pasos?",
  },
  de: {
    loading: "Dokument wird geladen…",
    loadError: "Das Dokument konnte nicht geladen werden. Bitte Seite neu laden.",
    processing: "Dieses Dokument wird vorbereitet. Bitte versuchen Sie es gleich erneut.",
    unavailable: "Dieses Dokument kann nicht angezeigt werden. Bitte fordern Sie beim Absender einen neuen Link an.",
    page: "Seite",
    of: "von",
    validate: "Annehmen & unterschreiben",
    validated: "Angebot angenommen, vielen Dank!",
    confirmValidate: "Bestätigen Sie, dass Sie dieses Angebot annehmen?",
    requestChange: "Änderung anfragen",
    changeRequested: "Ihre Anfrage wurde gesendet.",
    changePlaceholder: "Was möchten Sie anpassen?",
    send: "Senden",
    cancel: "Abbrechen",
    actionError: "Etwas ist schiefgelaufen, bitte erneut versuchen.",
    emailTitle: "Zum Dokument",
    emailDescription: "Geben Sie Ihre E-Mail ein, um dieses Dokument anzusehen.",
    emailLabel: "Geschäftliche E-Mail",
    nameLabel: "Name (optional)",
    emailSubmit: "Dokument ansehen",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    privacyNotice: "Der Absender sieht, welche Seiten dieses Dokuments wie lange angesehen werden, um sich zum richtigen Zeitpunkt zu melden.",
    privacyNoticeWeb: "Der Absender sieht, wann und wie lange dieses Dokument geöffnet wird, um sich zum richtigen Zeitpunkt zu melden.",
    privacyLink: "Datenschutz",
    openExternal: "In neuem Tab öffnen",
    externalTitle: "Dieses Dokument öffnet sich auf seiner eigenen Website",
    externalDescription: "Es kann hier nicht angezeigt werden. Öffnen Sie es in einem neuen Tab und kommen Sie dann zurück, um zu antworten.",
    sharedBy: "Gesendet von",
    readyPrompt: "Bereit für den nächsten Schritt?",
    confirmTitle: "Dieses Angebot annehmen",
    confirmAction: "Ja, ich nehme an",
    validatedNext: "Der Absender wurde benachrichtigt und meldet sich in Kürze.",
    changeTitle: "Was möchten Sie anpassen?",
    notFoundTitle: "Dieser Link ist nicht mehr verfügbar",
    notFoundText: "Er ist möglicherweise abgelaufen oder wurde zurückgezogen. Bitten Sie den Absender um einen neuen Link.",
    chatLauncher: "Frage stellen",
    chatTitle: "Fragen zu diesem Angebot?",
    chatIntro: "Hallo! Ich beantworte Ihre Fragen zu diesem Dokument, während {sender} nicht erreichbar ist.",
    chatPlaceholder: "Umfang, Preise, Konditionen…",
    chatClose: "Schließen",
    chatThinking: "Schreibt…",
    chatDisclaimer: "Automatische Antworten, nur auf Grundlage dieses Dokuments. {sender} kann diese Unterhaltung lesen.",
    chatForwarded: "Frage an {sender} weitergeleitet",
    chatError: "Der Assistent ist nicht verfügbar, bitte versuchen Sie es gleich noch einmal.",
    chatLimit: "Sie haben das Fragelimit vorerst erreicht. {sender} antwortet Ihnen gern direkt.",
    chatSenderFallback: "der Absender",
    chatSuggestScope: "Was genau ist enthalten?",
    chatSuggestPricing: "Wie läuft die Zahlung ab?",
    chatSuggestTiming: "Wie ist der Zeitplan?",
    chatSuggestTerms: "Was sind die Konditionen?",
    chatSuggestSummary: "Können Sie dieses Angebot zusammenfassen?",
    chatSuggestNext: "Was sind die nächsten Schritte?",
  },
};

// Picks the best supported locale from an Accept-Language header
export function pickLocale(acceptLanguage: string | null): SupportedLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q.split("=")[1]) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { base } of candidates) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
      return base as SupportedLocale;
    }
  }
  return DEFAULT_LOCALE;
}

export function getViewerLabels(locale: SupportedLocale): ViewerLabels {
  return LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
}
