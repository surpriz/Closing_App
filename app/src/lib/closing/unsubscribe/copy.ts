// Prospect-facing unsubscribe copy. Like the follow-ups themselves, it must
// never hint that reading is tracked.

export type UnsubscribeCopy = {
  footer: string;
  footerLink: string;
  pageTitle: string;
  pageDescription: string;
  pageButton: string;
  pageDone: string;
  pageInvalid: string;
};

const COPY: Record<"en" | "fr" | "es" | "de", UnsubscribeCopy> = {
  en: {
    footer: "Don't want to hear from us about this proposal anymore?",
    footerLink: "Unsubscribe",
    pageTitle: "Unsubscribe",
    pageDescription: "You will no longer receive automatic follow-ups from this sender at",
    pageButton: "Confirm",
    pageDone: "Done. You won't receive any more follow-ups.",
    pageInvalid: "This link is invalid or has expired.",
  },
  fr: {
    footer: "Vous ne souhaitez plus recevoir de messages au sujet de cette proposition ?",
    footerLink: "Se désinscrire",
    pageTitle: "Se désinscrire",
    pageDescription: "Vous ne recevrez plus de relances automatiques de cet expéditeur à l'adresse",
    pageButton: "Confirmer",
    pageDone: "C'est fait. Vous ne recevrez plus de relances.",
    pageInvalid: "Ce lien n'est pas valide ou a expiré.",
  },
  es: {
    footer: "¿Ya no quieres recibir mensajes sobre esta propuesta?",
    footerLink: "Darse de baja",
    pageTitle: "Darse de baja",
    pageDescription: "Ya no recibirás seguimientos automáticos de este remitente en",
    pageButton: "Confirmar",
    pageDone: "Listo. Ya no recibirás más seguimientos.",
    pageInvalid: "Este enlace no es válido o ha caducado.",
  },
  de: {
    footer: "Sie möchten keine Nachrichten mehr zu diesem Angebot erhalten?",
    footerLink: "Abmelden",
    pageTitle: "Abmelden",
    pageDescription: "Sie erhalten keine automatischen Nachfassaktionen mehr von diesem Absender an",
    pageButton: "Bestätigen",
    pageDone: "Erledigt. Sie erhalten keine weiteren Nachrichten.",
    pageInvalid: "Dieser Link ist ungültig oder abgelaufen.",
  },
};

export function getUnsubscribeCopy(locale: string | null | undefined): UnsubscribeCopy {
  const base = (locale ?? "").toLowerCase().split("-")[0];
  return COPY[base as keyof typeof COPY] ?? COPY.en;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function unsubscribeFooter(url: string, locale: string | null | undefined) {
  const copy = getUnsubscribeCopy(locale);
  return {
    text: `\n\n--\n${copy.footer} ${copy.footerLink} : ${url}`,
    html: `<p style="margin-top:32px;font-size:12px;color:#888">${escapeHtml(copy.footer)} <a href="${escapeHtml(url)}" style="color:#888">${escapeHtml(copy.footerLink)}</a></p>`,
  };
}
