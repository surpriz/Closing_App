import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/closing/constants";
import { matchLocale } from "@/i18n/locale";

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
  /** "via Clozer" badge on Free workspaces' links. */
  poweredBy: string;
  page: string;
  of: string;
  validate: string;
  validated: string;
  requestChange: string;
  changeRequested: string;
  bookMeeting: string;
  bookingTitle: string;
  bookingFallback: string;
  bookingOpenTab: string;
  meetingBooked: string;
  changePlaceholder: string;
  send: string;
  cancel: string;
  actionError: string;
  emailTitle: string;
  emailLabel: string;
  emailSubmit: string;
  invalidEmail: string;
  tooManyAttempts: string;
  privacyNotice: string;
  privacyNoticeWeb: string;
  privacyNoticeVideo: string;
  privacyLink: string;
  openExternal: string;
  externalTitle: string;
  /** Before the site name, above the article shown in Clozer. */
  readerSource: string;
  /** The reader's language menu, and the AI translation of the document. {language} is filled with languageName. */
  languageMenu: string;
  originalLanguage: string;
  translationOffer: string;
  translationAccept: string;
  translationDismiss: string;
  machineTranslated: string;
  showOriginal: string;
  showTranslation: string;
  translating: string;
  translationFailed: string;
  externalDescription: string;
  sharedBy: string;
  readyPrompt: string;
  confirmTitle: string;
  confirmAction: string;
  /** Under the title of the accept dialog: what accepting means and what happens next. */
  confirmHint: string;
  validatedNext: string;
  /** The gate knows who the link was sent to. {name}, {email} (masked). */
  greeting: string;
  sentTo: string;
  notMe: string;
  /** "Valider & signer": a typed name and an explicit agreement. */
  signName: string;
  signAgree: string;
  signedReceipt: string;
  download: string;
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
  /** The seller withdrew the link or the document: they can send it again. */
  archivedTitle: string;
  archivedText: string;
  requestRelink: string;
  relinkRequested: string;
  /** Assistant on the document. {sender} is replaced by the sender's name. */
  chatLauncher: string;
  /** The short form in the call-to-action bar. */
  chatAsk: string;
  /** Offered once when the mouse heads for the tab bar. */
  chatExitNudge: string;
  chatIntro: string;
  chatClose: string;
  chatThinking: string;
  chatDisclaimer: string;
  chatForwarded: string;
  chatError: string;
  chatLimit: string;
  chatSenderFallback: string;
  /** Seller capsule bubble on a page. {sender} as above. */
  capsuleFrom: string;
  capsuleOpen: string;
  capsuleClose: string;
  capsuleDismiss: string;
  /** Voice comment on a page. {page} is the page number. */
  voiceButton: string;
  voiceTitle: string;
  voiceHint: string;
  voiceStart: string;
  voiceStop: string;
  voiceRetry: string;
  voiceSend: string;
  voiceSending: string;
  voiceSent: string;
  voiceError: string;
  voiceLimit: string;
  voiceMicDenied: string;
  voiceUnsupported: string;
  /** Video pitch: the video is the document, "Demander un devis" under it. */
  requestQuote: string;
  quoteTitle: string;
  quotePlaceholder: string;
  quoteRequested: string;
  videoError: string;
  playVideo: string;
  /** "Transférer": the reader sends the link to a colleague. {sender}, {email}. */
  forwardButton: string;
  forwardTitle: string;
  forwardDescription: string;
  forwardToEmail: string;
  forwardToName: string;
  forwardMessage: string;
  forwardMessageNotice: string;
  forwardFromEmail: string;
  forwardFromName: string;
  forwardNotifyOpen: string;
  forwardSend: string;
  forwardSent: string;
  forwardAnother: string;
  forwardErrorSelf: string;
  forwardErrorSeller: string;
  forwardErrorUnavailable: string;
  forwardErrorLink: string;
  forwardErrorName: string;
  forwardErrorLimit: string;
  forwardError: string;
  /** Title, placeholder and suggested questions, by family of document (chat/kind.ts). */
  chatKinds: Record<ChatKind, ChatKindLabels>;
};

const LABELS: Record<"en" | "fr" | "es" | "de", ViewerLabels> = {
  en: {
    loading: "Loading the document…",
    loadError: "The document could not be loaded. Please refresh the page.",
    processing: "This document is being prepared. Please come back in a moment.",
    unavailable: "This document can't be displayed. Please ask the sender for a new link.",
    poweredBy: "Sent with Clozer",
    page: "Page",
    of: "of",
    validate: "Accept & sign",
    validated: "Accepted, thank you.",
    requestChange: "Request a change",
    changeRequested: "Request sent.",
    bookMeeting: "Book a meeting",
    bookingTitle: "Pick a time",
    bookingFallback: "The calendar does not show up here.",
    bookingOpenTab: "Open it in a new tab",
    meetingBooked: "Meeting booked. Talk soon.",
    changePlaceholder: "What would you like to adjust?",
    send: "Send",
    cancel: "Cancel",
    actionError: "Something went wrong, please try again.",
    emailTitle: "Access the document",
    emailLabel: "Your email",
    emailSubmit: "View the document",
    invalidEmail: "Please enter a valid email address.",
    tooManyAttempts: "Too many attempts. Please try again in a few minutes.",
    privacyNotice: "The sender can see which pages of this document are viewed and for how long, along with your approximate location and device, to follow up at the right time.",
    privacyNoticeWeb: "The sender can see when this document is opened and for how long, along with your approximate location and device, to follow up at the right time.",
    privacyNoticeVideo: "The sender can see which parts of this video are watched and for how long, along with your approximate location and device, to follow up at the right time.",
    privacyLink: "Privacy",
    openExternal: "Open in a new tab",
    externalTitle: "This document opens on its own site",
    readerSource: "Reader view of",
    languageMenu: "Language",
    originalLanguage: "original",
    translationOffer: "This document is in {language}.",
    translationAccept: "Translate to {language}",
    translationDismiss: "Keep the original",
    machineTranslated: "Machine translation. The original prevails.",
    showOriginal: "Show original",
    showTranslation: "Show translation",
    translating: "Translating, up to a minute. The original stays here meanwhile.",
    translationFailed: "Translation unavailable for now, here is the original.",
    externalDescription: "It cannot be displayed here. Open it in a new tab, then come back to reply.",
    sharedBy: "Shared by",
    readyPrompt: "What next?",
    confirmTitle: "Accept this proposal",
    confirmAction: "Accept",
    confirmHint: "By accepting, you agree to this proposal. The sender is notified and will get back to you with next steps.",
    validatedNext: "The sender has been notified.",
    greeting: "Hello {name}",
    sentTo: "Sent to {email}",
    notMe: "Not me",
    signName: "Your name",
    signAgree: "I agree",
    signedReceipt: "A confirmation has been sent to your email.",
    download: "Download the document",
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
    archivedTitle: "This document has been withdrawn",
    archivedText: "{sender} withdrew this document. You can ask them to send it again.",
    requestRelink: "Ask for the document again",
    relinkRequested: "Request sent. {sender} has been notified, and you'll get an email if the document is available again.",
    chatLauncher: "Ask a question",
    chatAsk: "A question?",
    chatExitNudge: "A question before you go?",
    chatIntro: "Hi! I can answer your questions about this document while {sender} is away.",
    chatClose: "Close",
    chatThinking: "Writing…",
    chatDisclaimer: "Automatic answers based on this document only. {sender} can read this conversation.",
    chatForwarded: "Question passed on to {sender}",
    chatError: "The assistant is unavailable, please try again in a moment.",
    chatLimit: "You've reached the question limit for now. {sender} will be happy to answer directly.",
    chatSenderFallback: "the sender",
    capsuleFrom: "A word from {sender}",
    capsuleOpen: "Play the message",
    capsuleClose: "Close",
    capsuleDismiss: "Hide",
    voiceButton: "Leave a voice note",
    voiceTitle: "Voice note on page {page}",
    voiceHint: "Up to 60 seconds. {sender} gets it straight away.",
    voiceStart: "Record",
    voiceStop: "Stop",
    voiceRetry: "Start over",
    voiceSend: "Send",
    voiceSending: "Sending…",
    voiceSent: "Sent to {sender}",
    voiceError: "The voice note could not be sent, please try again.",
    voiceLimit: "You've sent several voice notes already. {sender} will get back to you.",
    voiceMicDenied: "Microphone access is blocked. Allow it in your browser and try again.",
    voiceUnsupported: "This browser can't record audio.",
    requestQuote: "Request a quote",
    quoteTitle: "Request a quote",
    quotePlaceholder: "What should the quote cover? (optional)",
    quoteRequested: "Request sent. The quote is on its way.",
    videoError: "This video can't play in this browser. Try another one, or contact the sender.",
    playVideo: "Play the video",
    forwardButton: "Forward",
    forwardTitle: "Forward the document",
    forwardDescription: "We email it to them on your behalf.",
    forwardToEmail: "Their email",
    forwardToName: "Their name (optional)",
    forwardMessage: "A note (optional)",
    forwardMessageNotice: "{sender} will also see this note.",
    forwardFromEmail: "Your email",
    forwardFromName: "Your name",
    forwardNotifyOpen: "Let me know when they open it",
    forwardSend: "Send",
    forwardSent: "Sent to {email}.",
    forwardAnother: "Forward to someone else",
    forwardErrorSelf: "That's your own address.",
    forwardErrorSeller: "{sender} already has this document.",
    forwardErrorUnavailable: "We can't send to this address.",
    forwardErrorLink: "The note can't contain a link.",
    forwardErrorName: "A name takes letters only, no digits or dots.",
    forwardErrorLimit: "You've forwarded this document several times today. Try again tomorrow.",
    forwardError: "It didn't go through. Please try again.",
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
    poweredBy: "Envoyé avec Clozer",
    page: "Page",
    of: "sur",
    validate: "Valider & signer",
    validated: "C'est validé, merci.",
    requestChange: "Demander un ajustement",
    changeRequested: "Demande envoyée.",
    bookMeeting: "Prendre rendez-vous",
    bookingTitle: "Choisissez un créneau",
    bookingFallback: "L'agenda ne s'affiche pas ici.",
    bookingOpenTab: "L'ouvrir dans un nouvel onglet",
    meetingBooked: "Rendez-vous réservé. À bientôt.",
    changePlaceholder: "Que souhaitez-vous ajuster ?",
    send: "Envoyer",
    cancel: "Annuler",
    actionError: "Une erreur est survenue, réessayez.",
    emailTitle: "Accéder au document",
    emailLabel: "Votre email",
    emailSubmit: "Voir le document",
    invalidEmail: "Adresse email invalide.",
    tooManyAttempts: "Trop de tentatives. Réessayez dans quelques minutes.",
    privacyNotice: "L'expéditeur voit quelles pages de ce document sont consultées et combien de temps, ainsi que votre localisation approximative et votre appareil, pour vous recontacter au bon moment.",
    privacyNoticeWeb: "L'expéditeur voit quand ce document est ouvert et combien de temps, ainsi que votre localisation approximative et votre appareil, pour vous recontacter au bon moment.",
    privacyNoticeVideo: "L'expéditeur voit quels passages de cette vidéo sont regardés et combien de temps, ainsi que votre localisation approximative et votre appareil, pour vous recontacter au bon moment.",
    privacyLink: "Confidentialité",
    openExternal: "Ouvrir dans un nouvel onglet",
    externalTitle: "Ce document s'ouvre sur son propre site",
    readerSource: "Version lecture de",
    languageMenu: "Langue",
    originalLanguage: "original",
    translationOffer: "Ce document est en {language}.",
    translationAccept: "Traduire en {language}",
    translationDismiss: "Garder l'original",
    machineTranslated: "Traduction automatique. L'original fait foi.",
    showOriginal: "Voir l'original",
    showTranslation: "Voir la traduction",
    translating: "Traduction en cours, jusqu'à une minute. L'original reste affiché en attendant.",
    translationFailed: "Traduction indisponible pour le moment, voici l'original.",
    externalDescription: "Il ne peut pas s'afficher ici. Ouvrez-le dans un nouvel onglet, puis revenez pour répondre.",
    sharedBy: "Envoyé par",
    readyPrompt: "Et pour la suite ?",
    confirmTitle: "Valider cette proposition",
    confirmAction: "Valider",
    confirmHint: "En validant, vous donnez votre accord sur cette proposition. L'expéditeur est prévenu et revient vers vous pour la suite.",
    validatedNext: "L'expéditeur est prévenu.",
    greeting: "Bonjour {name}",
    sentTo: "Envoyé à {email}",
    notMe: "Ce n'est pas moi",
    signName: "Votre nom",
    signAgree: "Bon pour accord",
    signedReceipt: "Un récapitulatif vous a été envoyé par email.",
    download: "Télécharger le document",
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
    archivedTitle: "Ce document a été retiré",
    archivedText: "{sender} a retiré ce document. Vous pouvez lui demander de vous le renvoyer.",
    requestRelink: "Redemander le document",
    relinkRequested: "Demande envoyée. {sender} est prévenu et vous recevrez un email si le document est de nouveau disponible.",
    chatLauncher: "Poser une question",
    chatAsk: "Une question ?",
    chatExitNudge: "Une question avant de partir ?",
    chatIntro: "Bonjour ! Je peux répondre à vos questions sur ce document en l'absence de {sender}.",
    chatClose: "Fermer",
    chatThinking: "Rédaction…",
    chatDisclaimer: "Réponses automatiques basées uniquement sur ce document. {sender} peut lire cette conversation.",
    chatForwarded: "Question transmise à {sender}",
    chatError: "L'assistant est indisponible, réessayez dans un instant.",
    chatLimit: "Vous avez atteint la limite de questions pour le moment. {sender} vous répondra volontiers directement.",
    chatSenderFallback: "l'expéditeur",
    capsuleFrom: "Un mot de {sender}",
    capsuleOpen: "Lancer le message",
    capsuleClose: "Fermer",
    capsuleDismiss: "Masquer",
    voiceButton: "Laisser un vocal",
    voiceTitle: "Vocal sur la page {page}",
    voiceHint: "Jusqu'à 60 secondes. {sender} le reçoit tout de suite.",
    voiceStart: "Enregistrer",
    voiceStop: "Arrêter",
    voiceRetry: "Recommencer",
    voiceSend: "Envoyer",
    voiceSending: "Envoi…",
    voiceSent: "Envoyé à {sender}",
    voiceError: "Le vocal n'a pas pu partir, réessayez.",
    voiceLimit: "Vous avez déjà envoyé plusieurs vocaux. {sender} va revenir vers vous.",
    voiceMicDenied: "L'accès au micro est bloqué. Autorisez-le dans votre navigateur puis réessayez.",
    voiceUnsupported: "Ce navigateur ne permet pas d'enregistrer.",
    requestQuote: "Demander un devis",
    quoteTitle: "Demander un devis",
    quotePlaceholder: "Que doit couvrir le devis ? (facultatif)",
    quoteRequested: "Demande envoyée. Le devis arrive.",
    videoError: "Cette vidéo ne s'ouvre pas dans ce navigateur. Essayez-en un autre, ou contactez l'expéditeur.",
    playVideo: "Lire la vidéo",
    forwardButton: "Transférer",
    forwardTitle: "Transférer le document",
    forwardDescription: "Nous lui envoyons le document par email, de votre part.",
    forwardToEmail: "Son email",
    forwardToName: "Son nom (facultatif)",
    forwardMessage: "Un mot (facultatif)",
    forwardMessageNotice: "{sender} verra aussi ce message.",
    forwardFromEmail: "Votre email",
    forwardFromName: "Votre nom",
    forwardNotifyOpen: "Me prévenir quand cette personne l'ouvre",
    forwardSend: "Envoyer",
    forwardSent: "Envoyé à {email}.",
    forwardAnother: "Transférer à quelqu'un d'autre",
    forwardErrorSelf: "C'est votre propre adresse.",
    forwardErrorSeller: "{sender} a déjà ce document.",
    forwardErrorUnavailable: "Impossible d'envoyer à cette adresse.",
    forwardErrorLink: "Le message ne peut pas contenir de lien.",
    forwardErrorName: "Un nom ne contient que des lettres, sans chiffres ni points.",
    forwardErrorLimit: "Vous avez déjà transféré ce document plusieurs fois aujourd'hui. Réessayez demain.",
    forwardError: "L'envoi n'a pas abouti. Réessayez.",
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
    poweredBy: "Enviado con Clozer",
    page: "Página",
    of: "de",
    validate: "Aceptar y firmar",
    validated: "Aceptada, gracias.",
    requestChange: "Solicitar un ajuste",
    changeRequested: "Solicitud enviada.",
    bookMeeting: "Reservar una reunión",
    bookingTitle: "Elige un horario",
    bookingFallback: "La agenda no se muestra aquí.",
    bookingOpenTab: "Abrirla en una pestaña nueva",
    meetingBooked: "Reunión reservada. Hasta pronto.",
    changePlaceholder: "¿Qué te gustaría ajustar?",
    send: "Enviar",
    cancel: "Cancelar",
    actionError: "Algo salió mal, inténtalo de nuevo.",
    emailTitle: "Acceder al documento",
    emailLabel: "Tu email",
    emailSubmit: "Ver el documento",
    invalidEmail: "Introduce un email válido.",
    tooManyAttempts: "Demasiados intentos. Vuelve a intentarlo en unos minutos.",
    privacyNotice: "El remitente puede ver qué páginas de este documento se consultan y durante cuánto tiempo, junto con tu ubicación aproximada y tu dispositivo, para contactarte en el momento adecuado.",
    privacyNoticeWeb: "El remitente puede ver cuándo se abre este documento y durante cuánto tiempo, junto con tu ubicación aproximada y tu dispositivo, para contactarte en el momento adecuado.",
    privacyNoticeVideo: "El remitente puede ver qué partes de este vídeo se ven y durante cuánto tiempo, así como tu ubicación aproximada y tu dispositivo, para hacer un seguimiento en el momento adecuado.",
    privacyLink: "Privacidad",
    openExternal: "Abrir en una pestaña nueva",
    externalTitle: "Este documento se abre en su propio sitio",
    readerSource: "Versión de lectura de",
    languageMenu: "Idioma",
    originalLanguage: "original",
    translationOffer: "Este documento está en {language}.",
    translationAccept: "Ver en {language}",
    translationDismiss: "Mantener el original",
    machineTranslated: "Traducción automática. Prevalece el original.",
    showOriginal: "Ver el original",
    showTranslation: "Ver la traducción",
    translating: "Traduciendo, hasta un minuto. Mientras tanto se muestra el original.",
    translationFailed: "Traducción no disponible por ahora, aquí está el original.",
    externalDescription: "No se puede mostrar aquí. Ábrelo en una pestaña nueva y vuelve para responder.",
    sharedBy: "Enviado por",
    readyPrompt: "¿Qué sigue?",
    confirmTitle: "Aceptar esta propuesta",
    confirmAction: "Aceptar",
    confirmHint: "Al aceptar, das tu conformidad a esta propuesta. El remitente recibe un aviso y te contactará para los siguientes pasos.",
    validatedNext: "El remitente ha sido avisado.",
    greeting: "Hola {name}",
    sentTo: "Enviado a {email}",
    notMe: "No soy yo",
    signName: "Tu nombre",
    signAgree: "Conforme",
    signedReceipt: "Te hemos enviado un resumen por email.",
    download: "Descargar el documento",
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
    archivedTitle: "Este documento ha sido retirado",
    archivedText: "{sender} retiró este documento. Puedes pedirle que te lo vuelva a enviar.",
    requestRelink: "Volver a pedir el documento",
    relinkRequested: "Solicitud enviada. {sender} ha sido avisado y recibirás un email si el documento vuelve a estar disponible.",
    chatLauncher: "Hacer una pregunta",
    chatAsk: "¿Alguna pregunta?",
    chatExitNudge: "¿Alguna pregunta antes de irse?",
    chatIntro: "¡Hola! Puedo responder a sus preguntas sobre este documento mientras {sender} no está disponible.",
    chatClose: "Cerrar",
    chatThinking: "Escribiendo…",
    chatDisclaimer: "Respuestas automáticas basadas solo en este documento. {sender} puede leer esta conversación.",
    chatForwarded: "Pregunta enviada a {sender}",
    chatError: "El asistente no está disponible, inténtelo de nuevo en un momento.",
    chatLimit: "Ha alcanzado el límite de preguntas por ahora. {sender} le responderá con gusto directamente.",
    chatSenderFallback: "el remitente",
    capsuleFrom: "Un mensaje de {sender}",
    capsuleOpen: "Reproducir el mensaje",
    capsuleClose: "Cerrar",
    capsuleDismiss: "Ocultar",
    voiceButton: "Dejar una nota de voz",
    voiceTitle: "Nota de voz en la página {page}",
    voiceHint: "Hasta 60 segundos. {sender} la recibe al momento.",
    voiceStart: "Grabar",
    voiceStop: "Detener",
    voiceRetry: "Volver a empezar",
    voiceSend: "Enviar",
    voiceSending: "Enviando…",
    voiceSent: "Enviada a {sender}",
    voiceError: "No se pudo enviar la nota de voz, inténtelo de nuevo.",
    voiceLimit: "Ya ha enviado varias notas de voz. {sender} le responderá.",
    voiceMicDenied: "El acceso al micrófono está bloqueado. Permítalo en su navegador y vuelva a intentarlo.",
    voiceUnsupported: "Este navegador no puede grabar audio.",
    requestQuote: "Solicitar un presupuesto",
    quoteTitle: "Solicitar un presupuesto",
    quotePlaceholder: "¿Qué debe incluir el presupuesto? (opcional)",
    quoteRequested: "Solicitud enviada. El presupuesto está en camino.",
    videoError: "Este vídeo no se puede reproducir en este navegador. Prueba con otro o contacta con el remitente.",
    playVideo: "Reproducir el vídeo",
    forwardButton: "Reenviar",
    forwardTitle: "Reenviar el documento",
    forwardDescription: "Se lo enviamos por email en tu nombre.",
    forwardToEmail: "Su email",
    forwardToName: "Su nombre (opcional)",
    forwardMessage: "Una nota (opcional)",
    forwardMessageNotice: "{sender} también verá esta nota.",
    forwardFromEmail: "Tu email",
    forwardFromName: "Tu nombre",
    forwardNotifyOpen: "Avisarme cuando lo abra",
    forwardSend: "Enviar",
    forwardSent: "Enviado a {email}.",
    forwardAnother: "Reenviar a otra persona",
    forwardErrorSelf: "Es tu propia dirección.",
    forwardErrorSeller: "{sender} ya tiene este documento.",
    forwardErrorUnavailable: "No podemos enviar a esta dirección.",
    forwardErrorLink: "La nota no puede contener enlaces.",
    forwardErrorName: "Un nombre solo lleva letras, sin números ni puntos.",
    forwardErrorLimit: "Ya has reenviado este documento varias veces hoy. Inténtalo mañana.",
    forwardError: "No se ha podido enviar. Inténtalo de nuevo.",
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
    poweredBy: "Gesendet mit Clozer",
    page: "Seite",
    of: "von",
    validate: "Annehmen & unterschreiben",
    validated: "Angenommen, vielen Dank.",
    requestChange: "Änderung anfragen",
    changeRequested: "Anfrage gesendet.",
    bookMeeting: "Termin vereinbaren",
    bookingTitle: "Wählen Sie einen Termin",
    bookingFallback: "Der Kalender wird hier nicht angezeigt.",
    bookingOpenTab: "In einem neuen Tab öffnen",
    meetingBooked: "Termin gebucht. Bis bald.",
    changePlaceholder: "Was möchten Sie anpassen?",
    send: "Senden",
    cancel: "Abbrechen",
    actionError: "Etwas ist schiefgelaufen, bitte erneut versuchen.",
    emailTitle: "Zum Dokument",
    emailLabel: "Ihre E-Mail",
    emailSubmit: "Dokument ansehen",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    tooManyAttempts: "Zu viele Versuche. Bitte versuchen Sie es in ein paar Minuten erneut.",
    privacyNotice: "Der Absender sieht, welche Seiten dieses Dokuments wie lange angesehen werden, sowie Ihren ungefähren Standort und Ihr Gerät, um sich zum richtigen Zeitpunkt zu melden.",
    privacyNoticeWeb: "Der Absender sieht, wann und wie lange dieses Dokument geöffnet wird, sowie Ihren ungefähren Standort und Ihr Gerät, um sich zum richtigen Zeitpunkt zu melden.",
    privacyNoticeVideo: "Der Absender sieht, welche Teile dieses Videos wie lange angesehen werden, sowie Ihren ungefähren Standort und Ihr Gerät, um sich zum richtigen Zeitpunkt zu melden.",
    privacyLink: "Datenschutz",
    openExternal: "In neuem Tab öffnen",
    externalTitle: "Dieses Dokument öffnet sich auf seiner eigenen Website",
    readerSource: "Leseansicht von",
    languageMenu: "Sprache",
    originalLanguage: "Original",
    translationOffer: "Dieses Dokument ist auf {language}.",
    translationAccept: "Auf {language} übersetzen",
    translationDismiss: "Original behalten",
    machineTranslated: "Maschinelle Übersetzung. Maßgeblich ist das Original.",
    showOriginal: "Original anzeigen",
    showTranslation: "Übersetzung anzeigen",
    translating: "Wird übersetzt, bis zu einer Minute. Bis dahin bleibt das Original sichtbar.",
    translationFailed: "Übersetzung gerade nicht verfügbar, hier ist das Original.",
    externalDescription: "Es kann hier nicht angezeigt werden. Öffnen Sie es in einem neuen Tab und kommen Sie dann zurück, um zu antworten.",
    sharedBy: "Gesendet von",
    readyPrompt: "Wie geht es weiter?",
    confirmTitle: "Dieses Angebot annehmen",
    confirmAction: "Annehmen",
    confirmHint: "Mit der Annahme stimmen Sie diesem Angebot zu. Der Absender wird benachrichtigt und meldet sich wegen der nächsten Schritte.",
    validatedNext: "Der Absender wurde benachrichtigt.",
    greeting: "Hallo {name}",
    sentTo: "Gesendet an {email}",
    notMe: "Das bin ich nicht",
    signName: "Ihr Name",
    signAgree: "Einverstanden",
    signedReceipt: "Eine Bestätigung wurde Ihnen per E-Mail gesendet.",
    download: "Dokument herunterladen",
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
    archivedTitle: "Dieses Dokument wurde zurückgezogen",
    archivedText: "{sender} hat dieses Dokument zurückgezogen. Sie können um erneute Zusendung bitten.",
    requestRelink: "Dokument erneut anfragen",
    relinkRequested: "Anfrage gesendet. {sender} wurde benachrichtigt, und Sie erhalten eine E-Mail, sobald das Dokument wieder verfügbar ist.",
    chatLauncher: "Frage stellen",
    chatAsk: "Eine Frage?",
    chatExitNudge: "Noch eine Frage, bevor Sie gehen?",
    chatIntro: "Hallo! Ich beantworte Ihre Fragen zu diesem Dokument, während {sender} nicht erreichbar ist.",
    chatClose: "Schließen",
    chatThinking: "Schreibt…",
    chatDisclaimer: "Automatische Antworten, nur auf Grundlage dieses Dokuments. {sender} kann diese Unterhaltung lesen.",
    chatForwarded: "Frage an {sender} weitergeleitet",
    chatError: "Der Assistent ist nicht verfügbar, bitte versuchen Sie es gleich noch einmal.",
    chatLimit: "Sie haben das Fragelimit vorerst erreicht. {sender} antwortet Ihnen gern direkt.",
    chatSenderFallback: "der Absender",
    capsuleFrom: "Eine Nachricht von {sender}",
    capsuleOpen: "Nachricht abspielen",
    capsuleClose: "Schließen",
    capsuleDismiss: "Ausblenden",
    voiceButton: "Sprachnachricht hinterlassen",
    voiceTitle: "Sprachnachricht zu Seite {page}",
    voiceHint: "Bis zu 60 Sekunden. {sender} erhält sie sofort.",
    voiceStart: "Aufnehmen",
    voiceStop: "Stopp",
    voiceRetry: "Neu beginnen",
    voiceSend: "Senden",
    voiceSending: "Wird gesendet…",
    voiceSent: "An {sender} gesendet",
    voiceError: "Die Sprachnachricht konnte nicht gesendet werden. Bitte erneut versuchen.",
    voiceLimit: "Sie haben bereits mehrere Sprachnachrichten gesendet. {sender} meldet sich bei Ihnen.",
    voiceMicDenied: "Der Mikrofonzugriff ist blockiert. Erlauben Sie ihn im Browser und versuchen Sie es erneut.",
    voiceUnsupported: "Dieser Browser kann kein Audio aufnehmen.",
    requestQuote: "Angebot anfordern",
    quoteTitle: "Angebot anfordern",
    quotePlaceholder: "Was soll das Angebot umfassen? (optional)",
    quoteRequested: "Anfrage gesendet. Das Angebot kommt.",
    videoError: "Dieses Video kann in diesem Browser nicht abgespielt werden. Versuchen Sie einen anderen oder kontaktieren Sie den Absender.",
    playVideo: "Video abspielen",
    forwardButton: "Weiterleiten",
    forwardTitle: "Dokument weiterleiten",
    forwardDescription: "Wir senden es per E-Mail in Ihrem Namen.",
    forwardToEmail: "E-Mail des Empfängers",
    forwardToName: "Name (optional)",
    forwardMessage: "Eine Notiz (optional)",
    forwardMessageNotice: "{sender} sieht diese Notiz ebenfalls.",
    forwardFromEmail: "Ihre E-Mail",
    forwardFromName: "Ihr Name",
    forwardNotifyOpen: "Benachrichtigen, wenn die Person es öffnet",
    forwardSend: "Senden",
    forwardSent: "Gesendet an {email}.",
    forwardAnother: "An jemand anderen weiterleiten",
    forwardErrorSelf: "Das ist Ihre eigene Adresse.",
    forwardErrorSeller: "{sender} hat dieses Dokument bereits.",
    forwardErrorUnavailable: "An diese Adresse können wir nicht senden.",
    forwardErrorLink: "Die Notiz darf keinen Link enthalten.",
    forwardErrorName: "Ein Name enthält nur Buchstaben, keine Ziffern oder Punkte.",
    forwardErrorLimit: "Sie haben dieses Dokument heute schon mehrmals weitergeleitet. Versuchen Sie es morgen erneut.",
    forwardError: "Das Senden hat nicht geklappt. Bitte erneut versuchen.",
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
  return matchLocale(acceptLanguage, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

/** The language the reader picked in the viewer's menu: labels, assistant and translation follow it. */
export const VIEWER_LOCALE_COOKIE = "clozer_viewer_lang";
export const VIEWER_LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function chosenLocale(cookieValue: string | undefined): SupportedLocale | null {
  return isSupportedLocale(cookieValue) ? cookieValue : null;
}

export function getViewerLabels(locale: SupportedLocale): ViewerLabels {
  return LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
}

/** The language the labels are really in: Italian and Portuguese readers get the English ones. */
export function labelsLocale(locale: SupportedLocale): SupportedLocale {
  return locale in LABELS ? locale : "en";
}

/** Fills the {sender}, {page}, {email} and {language} placeholders of a label. */
export function fillLabel(
  text: string,
  values: { sender?: string; page?: number; email?: string; language?: string },
) {
  let filled = text;
  if (values.language !== undefined) filled = filled.replaceAll("{language}", values.language);
  if (values.email !== undefined) filled = filled.replaceAll("{email}", values.email);
  if (values.sender !== undefined) filled = filled.replaceAll("{sender}", values.sender);
  if (values.page !== undefined) filled = filled.replaceAll("{page}", String(values.page));
  return filled;
}
