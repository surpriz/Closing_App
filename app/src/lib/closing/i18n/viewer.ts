import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/closing/constants";

export type ViewerLabels = {
  loading: string;
  loadError: string;
  processing: string;
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
};

const LABELS: Record<"en" | "fr" | "es" | "de", ViewerLabels> = {
  en: {
    loading: "Loading the proposal…",
    loadError: "The document could not be loaded. Please refresh the page.",
    processing: "This document is being prepared. Please come back in a moment.",
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
    emailTitle: "Access the proposal",
    emailDescription: "Enter your email to view this document.",
    emailLabel: "Work email",
    nameLabel: "Name (optional)",
    emailSubmit: "View the document",
    invalidEmail: "Please enter a valid email address.",
  },
  fr: {
    loading: "Chargement de la proposition…",
    loadError: "Impossible de charger le document. Rechargez la page.",
    processing: "Ce document est en cours de préparation. Revenez dans un instant.",
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
    emailTitle: "Accéder à la proposition",
    emailDescription: "Indiquez votre email pour consulter ce document.",
    emailLabel: "Email professionnel",
    nameLabel: "Nom (facultatif)",
    emailSubmit: "Voir le document",
    invalidEmail: "Adresse email invalide.",
  },
  es: {
    loading: "Cargando la propuesta…",
    loadError: "No se pudo cargar el documento. Recarga la página.",
    processing: "Este documento se está preparando. Vuelve en un momento.",
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
    emailTitle: "Acceder a la propuesta",
    emailDescription: "Introduce tu email para ver este documento.",
    emailLabel: "Email profesional",
    nameLabel: "Nombre (opcional)",
    emailSubmit: "Ver el documento",
    invalidEmail: "Introduce un email válido.",
  },
  de: {
    loading: "Angebot wird geladen…",
    loadError: "Das Dokument konnte nicht geladen werden. Bitte Seite neu laden.",
    processing: "Dieses Dokument wird vorbereitet. Bitte versuchen Sie es gleich erneut.",
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
    emailTitle: "Zum Angebot",
    emailDescription: "Geben Sie Ihre E-Mail ein, um dieses Dokument anzusehen.",
    emailLabel: "Geschäftliche E-Mail",
    nameLabel: "Name (optional)",
    emailSubmit: "Dokument ansehen",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
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
