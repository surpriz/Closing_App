/**
 * The email telling a prospect who asked for more time that the link opens
 * again. Plain text, like a follow-up: it comes from the seller, not a robot.
 */

type Input = { documentName: string; senderName: string | null; deadline: string | null; url: string };

const COPY: Record<"en" | "fr" | "es" | "de", (input: Input) => { subject: string; body: string }> = {
  en: ({ documentName, senderName, deadline, url }) => ({
    subject: `"${documentName}" is available again`,
    body: `Hello,\n\nAs you asked, ${senderName ?? "the sender"} has reopened "${documentName}"${deadline ? ` until ${deadline}` : ""}.\n\n${url}`,
  }),
  fr: ({ documentName, senderName, deadline, url }) => ({
    subject: `« ${documentName} » est de nouveau disponible`,
    body: `Bonjour,\n\nComme vous l'avez demandé, ${senderName ?? "l'expéditeur"} a réactivé « ${documentName} »${deadline ? ` jusqu'au ${deadline}` : ""}.\n\n${url}`,
  }),
  es: ({ documentName, senderName, deadline, url }) => ({
    subject: `"${documentName}" vuelve a estar disponible`,
    body: `Hola:\n\nComo pediste, ${senderName ?? "el remitente"} ha reactivado "${documentName}"${deadline ? ` hasta el ${deadline}` : ""}.\n\n${url}`,
  }),
  de: ({ documentName, senderName, deadline, url }) => ({
    subject: `„${documentName}" ist wieder verfügbar`,
    body: `Guten Tag,\n\nwie gewünscht hat ${senderName ?? "der Absender"} „${documentName}"${deadline ? ` bis ${deadline}` : ""} wieder freigeschaltet.\n\n${url}`,
  }),
};

export function reactivatedEmail(locale: string | null | undefined, input: Input) {
  const base = (locale ?? "").toLowerCase().split("-")[0];
  return (COPY[base as keyof typeof COPY] ?? COPY.en)(input);
}
