/**
 * What "Transférer" sends: a short note from the reader who passed the
 * document on, in their words, with the link. Plain text like every prospect
 * email. And the opt-in note back to that reader once the recipient opened it.
 */

type ForwardInput = {
  fromName: string;
  toName: string | null;
  documentName: string;
  senderName: string | null;
  message: string | null;
  url: string;
};

type ReceiptInput = { toName: string; documentName: string; url: string };

type Copy = {
  forward: (input: ForwardInput) => { subject: string; body: string };
  receipt: (input: ReceiptInput) => { subject: string; body: string };
};

const quote = (message: string | null) => (message ? `"${message}"\n\n` : "");
const quoteFr = (message: string | null) => (message ? `« ${message} »\n\n` : "");

const COPY: Record<"en" | "fr" | "es" | "de", Copy> = {
  en: {
    forward: ({ fromName, toName, documentName, senderName, message, url }) => ({
      subject: `${fromName} shared "${documentName}" with you`,
      body: `Hello${toName ? ` ${toName}` : ""},\n\n${fromName} shared "${documentName}"${senderName ? ` from ${senderName}` : ""} with you.\n\n${quote(message)}The document: ${url}\n\nReplying to this email writes to ${fromName}.`,
    }),
    receipt: ({ toName, documentName, url }) => ({
      subject: `${toName} opened "${documentName}"`,
      body: `Hello,\n\n${toName} opened "${documentName}", which you shared with them.\n\nThe document: ${url}`,
    }),
  },
  fr: {
    forward: ({ fromName, toName, documentName, senderName, message, url }) => ({
      subject: `${fromName} vous transfère « ${documentName} »`,
      body: `Bonjour${toName ? ` ${toName}` : ""},\n\n${fromName} vous transfère « ${documentName} »${senderName ? `, de ${senderName}` : ""}.\n\n${quoteFr(message)}Le document : ${url}\n\nRépondre à cet email écrit à ${fromName}.`,
    }),
    receipt: ({ toName, documentName, url }) => ({
      subject: `${toName} a ouvert « ${documentName} »`,
      body: `Bonjour,\n\n${toName} a ouvert « ${documentName} », que vous lui avez transféré.\n\nLe document : ${url}`,
    }),
  },
  es: {
    forward: ({ fromName, toName, documentName, senderName, message, url }) => ({
      subject: `${fromName} te ha compartido "${documentName}"`,
      body: `Hola${toName ? ` ${toName}` : ""}:\n\n${fromName} te ha compartido "${documentName}"${senderName ? `, de ${senderName}` : ""}.\n\n${quote(message)}El documento: ${url}\n\nSi respondes a este email, le escribes a ${fromName}.`,
    }),
    receipt: ({ toName, documentName, url }) => ({
      subject: `${toName} ha abierto "${documentName}"`,
      body: `Hola:\n\n${toName} ha abierto "${documentName}", que le compartiste.\n\nEl documento: ${url}`,
    }),
  },
  de: {
    forward: ({ fromName, toName, documentName, senderName, message, url }) => ({
      subject: `${fromName} hat „${documentName}" mit Ihnen geteilt`,
      body: `Guten Tag${toName ? ` ${toName}` : ""},\n\n${fromName} hat „${documentName}"${senderName ? ` von ${senderName}` : ""} mit Ihnen geteilt.\n\n${quote(message)}Das Dokument: ${url}\n\nEine Antwort auf diese E-Mail geht an ${fromName}.`,
    }),
    receipt: ({ toName, documentName, url }) => ({
      subject: `${toName} hat „${documentName}" geöffnet`,
      body: `Guten Tag,\n\n${toName} hat „${documentName}" geöffnet, das Sie geteilt haben.\n\nDas Dokument: ${url}`,
    }),
  },
};

function copyFor(locale: string | null | undefined) {
  const base = (locale ?? "").toLowerCase().split("-")[0];
  return COPY[base as keyof typeof COPY] ?? COPY.en;
}

export function forwardEmail(locale: string | null | undefined, input: ForwardInput) {
  return copyFor(locale).forward(input);
}

export function forwardReceiptEmail(locale: string | null | undefined, input: ReceiptInput) {
  return copyFor(locale).receipt(input);
}

/** The From name: the reader who forwards, so the recipient knows who it comes from. */
export function forwardSenderName(fromName: string) {
  return `${fromName} via Clozer`;
}
