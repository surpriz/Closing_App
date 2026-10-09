import { isPdfAttachment, type AttachmentInfo } from "../lib/compose";

// What the attachment event shows. Kept free of Office.js so it is tested.
export type Notice =
  // Replace it now, without asking (default)
  | { kind: "replace"; attachment: AttachmentInfo; progress: string }
  | { kind: "show"; message: string; actionText: string; attachmentId: string | null }
  | { kind: "clear" }
  | { kind: "none" };

// Outlook cuts notices at 150 characters and action labels at 30
const MAX_MESSAGE = 150;

function shorten(name: string, max: number) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function attachmentNotice(
  details: AttachmentInfo | null | undefined,
  status: string,
  connected: boolean,
  askFirst = false,
): Notice {
  if (status === "removed") return { kind: "clear" };
  if (status !== "added" || !isPdfAttachment(details)) return { kind: "none" };
  const name = shorten(details!.name, 60);
  if (!connected) {
    return {
      kind: "show",
      message: `Envoyez « ${name} » en lien Clozer : connectez d'abord Outlook à votre compte.`.slice(0, MAX_MESSAGE),
      actionText: "Connecter Clozer",
      attachmentId: null,
    };
  }
  if (!askFirst) return { kind: "replace", attachment: details!, progress: `Clozer remplace « ${name} » par un lien…`.slice(0, MAX_MESSAGE) };
  return {
    kind: "show",
    message: `Remplacer « ${name} » par un lien Clozer ?`.slice(0, MAX_MESSAGE),
    actionText: "Remplacer par un lien",
    attachmentId: details!.id,
  };
}

// Outcome of an automatic replacement, shown in the same bar
export function replacedMessage(name: string, note: string) {
  return `« ${shorten(name, 60)} » remplacé par un lien Clozer. ${note}`.slice(0, MAX_MESSAGE);
}

export function failedMessage(name: string, reason: string) {
  return `Clozer n'a pas pu remplacer « ${shorten(name, 40)} » : ${reason}`.slice(0, MAX_MESSAGE);
}
