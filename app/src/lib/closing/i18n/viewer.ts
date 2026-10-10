import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/closing/constants";

import type { ChatKind } from "../chat/kind";

export type ChatKindLabels = {
  title: string;
  placeholder: string;
  /** Suggested when the document has pages with that tag. */
  scope: string;
  pricing: string;
  timing: string;
  terms: string;
  /** Always offered last. */
  summary: string;
  next: string;
};

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
  /** Link expiry. {time} is the countdown, {sender} the sender's name. */
  expiryCountdown: string;
  expiryChip: string;
  countdownUnits: { d: string; h: string; min: string; s: string };
  expiredTitle: string;
  expiredText: string;
  /** Quotes and proposals: the price was guaranteed until then. */
  expiredTextQuote: string;
  requestExtension: string;
  extensionRequested: string;
  extensionEmailOptional: string;
  /** Shown to the seller looking at their own expired link. */
  extensionSellerPreview: string;
  /** Assistant on the document. {sender} is replaced by the sender's name. */
  chatLauncher: string;
  chatIntro: string;
  chatClose: string;
  chatThinking: string;
  chatDisclaimer: string;
  chatForwarded: string;
  chatError: string;
  chatLimit: string;
  chatSenderFallback: string;
  /** Title, placeholder and suggested questions, by family of document (chat/kind.ts). */
  chatKinds: Record<ChatKind, ChatKindLabels>;
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
    expiryCountdown: "This pricing is guaranteed for another {time}",
    expiryChip: "Offer valid for {time}",
    countdownUnits: { d: "d", h: "h", min: "min", s: "s" },
    expiredTitle: "This proposal has expired",
    expiredText: "The link is no longer active. {sender} can reopen it for you.",
    expiredTextQuote: "The pricing in this proposal is no longer guaranteed. {sender} can extend it for you.",
    requestExtension: "Request an extension",
    extensionRequested: "Request sent. {sender} has been notified, and you'll get an email as soon as the link is active again.",
    extensionEmailOptional: "Email (optional, to be notified)",
    extensionSellerPreview: "This is what your prospect sees. Your own request isn't sent.",
    chatLauncher: "Ask a question",
    chatIntro: "Hi! I can answer your questions about this document while {sender} is away.",
    chatClose: "Close",
    chatThinking: "Writing…",
    chatDisclaimer: "Automatic answers based on this document only. {sender} can read this conversation.",
    chatForwarded: "Question passed on to {sender}",
    chatError: "The assistant is unavailable, please try again in a moment.",
    chatLimit: "You've reached the question limit for now. {sender} will be happy to answer directly.",
    chatSenderFallback: "the sender",
    chatKinds: {
      offer: {
        title: "Questions about this proposal?",
        placeholder: "Scope, prices, conditions…",
        scope: "What exactly is included?",
        pricing: "How does payment work?",
        timing: "What is the timeline?",
        terms: "What are the conditions?",
        summary: "Can you sum up this proposal?",
        next: "What are the next steps?",
      },
      technical: {
        title: "Questions about this document?",
        placeholder: "Findings, recommendations, costs…",
        scope: "What are the main findings?",
        pricing: "What would it cost?",
        timing: "Where should we start?",
        terms: "What are the risks or prerequisites?",
        summary: "Can you sum up this document?",
        next: "What are the next steps?",
      },
      profile: {
        title: "Questions about this profile?",
        placeholder: "Skills, availability, rate…",
        scope: "What are the key skills?",
        pricing: "What is the rate?",
        timing: "When is the availability?",
        terms: "What are the working conditions?",
        summary: "Can you sum up this profile?",
        next: "How can we set up a call?",
      },
      document: {
        title: "Questions about this document?",
        placeholder: "Ask anything about the document…",
        scope: "What does this document cover?",
        pricing: "What are the prices?",
        timing: "What is the timeline?",
        terms: "What are the conditions?",
        summary: "Can you sum up this document?",
        next: "What are the next steps?",
      },
    },
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
    expiryCountdown: "Cette proposition tarifaire est garantie pour encore {time}",
    expiryChip: "Offre valable encore {time}",
    countdownUnits: { d: "j", h: "h", min: "min", s: "s" },
    expiredTitle: "Cette proposition a expiré",
    expiredText: "Le lien n'est plus actif. {sender} peut le réactiver pour vous.",
    expiredTextQuote: "Les conditions tarifaires de cette proposition ne sont plus garanties. {sender} peut la prolonger pour vous.",
    requestExtension: "Demander une prolongation",
    extensionRequested: "Demande envoyée. {sender} est prévenu et vous recevrez un email dès que le lien sera réactivé.",
    extensionEmailOptional: "Email (facultatif, pour être prévenu)",
    extensionSellerPreview: "C'est ce que voit votre prospect. Votre propre demande n'est pas envoyée.",
    chatLauncher: "Poser une question",
    chatIntro: "Bonjour ! Je peux répondre à vos questions sur ce document en l'absence de {sender}.",
    chatClose: "Fermer",
    chatThinking: "Rédaction…",
    chatDisclaimer: "Réponses automatiques basées uniquement sur ce document. {sender} peut lire cette conversation.",
    chatForwarded: "Question transmise à {sender}",
    chatError: "L'assistant est indisponible, réessayez dans un instant.",
    chatLimit: "Vous avez atteint la limite de questions pour le moment. {sender} vous répondra volontiers directement.",
    chatSenderFallback: "l'expéditeur",
    chatKinds: {
      offer: {
        title: "Une question sur cette proposition ?",
        placeholder: "Périmètre, prix, conditions…",
        scope: "Qu'est-ce qui est inclus exactement ?",
        pricing: "Comment se passe le paiement ?",
        timing: "Quel est le calendrier ?",
        terms: "Quelles sont les conditions ?",
        summary: "Pouvez-vous résumer cette proposition ?",
        next: "Quelles sont les prochaines étapes ?",
      },
      technical: {
        title: "Une question sur ce document ?",
        placeholder: "Constats, recommandations, coûts…",
        scope: "Quels sont les principaux constats ?",
        pricing: "Combien ça coûterait ?",
        timing: "Par quoi commencer ?",
        terms: "Quels sont les risques ou prérequis ?",
        summary: "Pouvez-vous résumer ce document ?",
        next: "Quelles sont les prochaines étapes ?",
      },
      profile: {
        title: "Une question sur ce profil ?",
        placeholder: "Compétences, disponibilité, tarif…",
        scope: "Quelles sont les compétences clés ?",
        pricing: "Quel est le tarif ?",
        timing: "Quelle est la disponibilité ?",
        terms: "Quelles sont les conditions de travail ?",
        summary: "Pouvez-vous résumer ce profil ?",
        next: "Comment organiser un échange ?",
      },
      document: {
        title: "Une question sur ce document ?",
        placeholder: "Votre question sur le document…",
        scope: "Que couvre ce document ?",
        pricing: "Quels sont les tarifs ?",
        timing: "Quel est le calendrier ?",
        terms: "Quelles sont les conditions ?",
        summary: "Pouvez-vous résumer ce document ?",
        next: "Quelles sont les prochaines étapes ?",
      },
    },
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
    expiryCountdown: "Esta propuesta de precio está garantizada durante {time} más",
    expiryChip: "Oferta válida {time} más",
    countdownUnits: { d: "d", h: "h", min: "min", s: "s" },
    expiredTitle: "Esta propuesta ha caducado",
    expiredText: "El enlace ya no está activo. {sender} puede reactivarlo para ti.",
    expiredTextQuote: "Las condiciones de precio de esta propuesta ya no están garantizadas. {sender} puede prolongarla para ti.",
    requestExtension: "Solicitar una prórroga",
    extensionRequested: "Solicitud enviada. {sender} ha sido avisado y recibirás un email en cuanto el enlace vuelva a estar activo.",
    extensionEmailOptional: "Email (opcional, para recibir el aviso)",
    extensionSellerPreview: "Esto es lo que ve tu cliente. Tu propia solicitud no se envía.",
    chatLauncher: "Hacer una pregunta",
    chatIntro: "¡Hola! Puedo responder a sus preguntas sobre este documento mientras {sender} no está disponible.",
    chatClose: "Cerrar",
    chatThinking: "Escribiendo…",
    chatDisclaimer: "Respuestas automáticas basadas solo en este documento. {sender} puede leer esta conversación.",
    chatForwarded: "Pregunta enviada a {sender}",
    chatError: "El asistente no está disponible, inténtelo de nuevo en un momento.",
    chatLimit: "Ha alcanzado el límite de preguntas por ahora. {sender} le responderá con gusto directamente.",
    chatSenderFallback: "el remitente",
    chatKinds: {
      offer: {
        title: "¿Preguntas sobre esta propuesta?",
        placeholder: "Alcance, precios, condiciones…",
        scope: "¿Qué incluye exactamente?",
        pricing: "¿Cómo funciona el pago?",
        timing: "¿Cuál es el calendario?",
        terms: "¿Cuáles son las condiciones?",
        summary: "¿Puede resumir esta propuesta?",
        next: "¿Cuáles son los próximos pasos?",
      },
      technical: {
        title: "¿Preguntas sobre este documento?",
        placeholder: "Conclusiones, recomendaciones, costes…",
        scope: "¿Cuáles son las principales conclusiones?",
        pricing: "¿Cuánto costaría?",
        timing: "¿Por dónde empezar?",
        terms: "¿Cuáles son los riesgos o requisitos previos?",
        summary: "¿Puede resumir este documento?",
        next: "¿Cuáles son los próximos pasos?",
      },
      profile: {
        title: "¿Preguntas sobre este perfil?",
        placeholder: "Competencias, disponibilidad, tarifa…",
        scope: "¿Cuáles son las competencias clave?",
        pricing: "¿Cuál es la tarifa?",
        timing: "¿Cuál es la disponibilidad?",
        terms: "¿Cuáles son las condiciones de trabajo?",
        summary: "¿Puede resumir este perfil?",
        next: "¿Cómo organizamos una llamada?",
      },
      document: {
        title: "¿Preguntas sobre este documento?",
        placeholder: "Su pregunta sobre el documento…",
        scope: "¿Qué cubre este documento?",
        pricing: "¿Cuáles son los precios?",
        timing: "¿Cuál es el calendario?",
        terms: "¿Cuáles son las condiciones?",
        summary: "¿Puede resumir este documento?",
        next: "¿Cuáles son los próximos pasos?",
      },
    },
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
    expiryCountdown: "Dieses Preisangebot ist noch {time} garantiert",
    expiryChip: "Angebot noch {time} gültig",
    countdownUnits: { d: "T", h: "Std", min: "Min", s: "s" },
    expiredTitle: "Dieses Angebot ist abgelaufen",
    expiredText: "Der Link ist nicht mehr aktiv. {sender} kann ihn für Sie wieder freischalten.",
    expiredTextQuote: "Die Preiskonditionen dieses Angebots sind nicht mehr garantiert. {sender} kann es für Sie verlängern.",
    requestExtension: "Verlängerung anfragen",
    extensionRequested: "Anfrage gesendet. {sender} wurde benachrichtigt, und Sie erhalten eine E-Mail, sobald der Link wieder aktiv ist.",
    extensionEmailOptional: "E-Mail (optional, um benachrichtigt zu werden)",
    extensionSellerPreview: "So sieht es Ihr Interessent. Ihre eigene Anfrage wird nicht gesendet.",
    chatLauncher: "Frage stellen",
    chatIntro: "Hallo! Ich beantworte Ihre Fragen zu diesem Dokument, während {sender} nicht erreichbar ist.",
    chatClose: "Schließen",
    chatThinking: "Schreibt…",
    chatDisclaimer: "Automatische Antworten, nur auf Grundlage dieses Dokuments. {sender} kann diese Unterhaltung lesen.",
    chatForwarded: "Frage an {sender} weitergeleitet",
    chatError: "Der Assistent ist nicht verfügbar, bitte versuchen Sie es gleich noch einmal.",
    chatLimit: "Sie haben das Fragelimit vorerst erreicht. {sender} antwortet Ihnen gern direkt.",
    chatSenderFallback: "der Absender",
    chatKinds: {
      offer: {
        title: "Fragen zu diesem Angebot?",
        placeholder: "Umfang, Preise, Konditionen…",
        scope: "Was genau ist enthalten?",
        pricing: "Wie läuft die Zahlung ab?",
        timing: "Wie ist der Zeitplan?",
        terms: "Was sind die Konditionen?",
        summary: "Können Sie dieses Angebot zusammenfassen?",
        next: "Was sind die nächsten Schritte?",
      },
      technical: {
        title: "Fragen zu diesem Dokument?",
        placeholder: "Ergebnisse, Empfehlungen, Kosten…",
        scope: "Was sind die wichtigsten Ergebnisse?",
        pricing: "Was würde das kosten?",
        timing: "Womit sollten wir anfangen?",
        terms: "Welche Risiken oder Voraussetzungen gibt es?",
        summary: "Können Sie dieses Dokument zusammenfassen?",
        next: "Was sind die nächsten Schritte?",
      },
      profile: {
        title: "Fragen zu diesem Profil?",
        placeholder: "Kompetenzen, Verfügbarkeit, Tagessatz…",
        scope: "Was sind die wichtigsten Kompetenzen?",
        pricing: "Wie hoch ist der Tagessatz?",
        timing: "Wann besteht Verfügbarkeit?",
        terms: "Was sind die Arbeitsbedingungen?",
        summary: "Können Sie dieses Profil zusammenfassen?",
        next: "Wie können wir ein Gespräch vereinbaren?",
      },
      document: {
        title: "Fragen zu diesem Dokument?",
        placeholder: "Ihre Frage zum Dokument…",
        scope: "Was behandelt dieses Dokument?",
        pricing: "Was sind die Preise?",
        timing: "Wie ist der Zeitplan?",
        terms: "Was sind die Konditionen?",
        summary: "Können Sie dieses Dokument zusammenfassen?",
        next: "Was sind die nächsten Schritte?",
      },
    },
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
