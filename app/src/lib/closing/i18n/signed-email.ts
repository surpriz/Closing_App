/**
 * The receipt a prospect gets after "Valider & signer": what they agreed to,
 * when, under which name. Plain text, from the seller's side like every
 * prospect email.
 */

/** Letters, spaces, apostrophes and hyphens: no dot, so "evil.com" can't become a link in the email. */
export const SIGNER_NAME = /^[\p{L}\p{M}][\p{L}\p{M}' -]{1,79}$/u;

type Input = { documentName: string; signerName: string; signedAt: string; senderName: string | null; url: string };

const COPY: Record<"en" | "fr" | "es" | "de", (input: Input) => { subject: string; body: string }> = {
  en: ({ documentName, signerName, signedAt, senderName, url }) => ({
    subject: `You accepted "${documentName}"`,
    body: `Hello,\n\nThis confirms that ${signerName} accepted "${documentName}" on ${signedAt}. ${senderName ?? "The sender"} has been notified.\n\nThe document: ${url}`,
  }),
  fr: ({ documentName, signerName, signedAt, senderName, url }) => ({
    subject: `Vous avez validé « ${documentName} »`,
    body: `Bonjour,\n\nVous avez validé « ${documentName} » le ${signedAt}, au nom de ${signerName}. ${senderName ?? "L'expéditeur"} est prévenu.\n\nLe document : ${url}`,
  }),
  es: ({ documentName, signerName, signedAt, senderName, url }) => ({
    subject: `Has aceptado "${documentName}"`,
    body: `Hola:\n\nConfirmamos que ${signerName} aceptó "${documentName}" el ${signedAt}. ${senderName ?? "El remitente"} ha sido avisado.\n\nEl documento: ${url}`,
  }),
  de: ({ documentName, signerName, signedAt, senderName, url }) => ({
    subject: `Sie haben „${documentName}" angenommen`,
    body: `Guten Tag,\n\nhiermit bestätigen wir, dass ${signerName} „${documentName}" am ${signedAt} angenommen hat. ${senderName ?? "Der Absender"} wurde benachrichtigt.\n\nDas Dokument: ${url}`,
  }),
};

export function signedEmail(locale: string | null | undefined, input: Input) {
  const base = (locale ?? "").toLowerCase().split("-")[0];
  return (COPY[base as keyof typeof COPY] ?? COPY.en)(input);
}
