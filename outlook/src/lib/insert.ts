import type { DocumentSummary } from "./api";
import { base64ToBytes, firstRecipient, type AttachmentInfo } from "./compose";
import { createLink, ensureDocument, linkContent, waitForTitle } from "./documents";
import { ClozerError } from "./errors";
import { rememberLink } from "./links-store";
import { officeCall } from "./office";
import { getLinkStyle } from "./settings";

// The whole "PDF → Clozer link" job, shared by the pane and the attachment event.
// `step` reports progress in the seller's words.

export const NOTICE_KEY = "clozer-pdf";

type Step = (text: string) => void;

export async function replaceAttachment(compose: Office.MessageCompose, attachment: AttachmentInfo, step: Step) {
  step("Lecture de la pièce jointe…");
  const content = await officeCall<Office.AttachmentContent>((callback) => compose.getAttachmentContentAsync(attachment.id, callback));
  if (content.format !== Office.MailboxEnums.AttachmentContentFormat.Base64) {
    throw new ClozerError("format", "Cette pièce jointe ne peut pas être lue. Ajoutez le PDF depuis le volet Clozer.");
  }
  const document = await ensureDocument(base64ToBytes(content.content), attachment.name, (percent) =>
    step(`Envoi du PDF… ${percent} %`),
  );
  return insertDocument(compose, document, step, attachment.id);
}

// Link for this email (first "To" recipient = prospect), inserted where the seller was typing
export async function insertDocument(compose: Office.MessageCompose, document: DocumentSummary, step: Step, attachmentId?: string) {
  step("Lecture du document…");
  document = await waitForTitle(document);

  step("Création du lien…");
  const to = await officeCall<Office.EmailAddressDetails[]>((callback) => compose.to.getAsync(callback)).catch(() => []);
  const recipient = firstRecipient(to);
  const link = await createLink(document.id, recipient);

  const bodyType = await officeCall<Office.CoercionType>((callback) => compose.body.getTypeAsync(callback)).catch(
    () => Office.CoercionType.Html,
  );
  const isHtml = bodyType === Office.CoercionType.Html;
  const content = linkContent(link, isHtml ? "html" : "text", getLinkStyle());
  const coercionType = isHtml ? Office.CoercionType.Html : Office.CoercionType.Text;
  try {
    await officeCall<void>((callback) => compose.body.setSelectedDataAsync(content, { coercionType }, callback));
  } catch {
    // No caret in the body (focus in the subject, or an event with the pane closed): top of the email
    await officeCall<void>((callback) => compose.body.prependAsync(content, { coercionType }, callback)).catch(() => {
      throw new ClozerError("insert", `Le lien n'a pas pu être inséré. Copiez-le : ${link.url}`);
    });
  }
  await rememberLink(compose, { id: link.id, url: link.url });

  let attachmentLeft = false;
  if (attachmentId) {
    attachmentLeft = await officeCall<void>((callback) => compose.removeAttachmentAsync(attachmentId, callback)).then(
      () => false,
      () => true,
    );
  }
  return { link, recipient, attachmentLeft };
}

// What the seller reads once the link is in
export function insertedNote(result: { recipient: { email: string; displayName: string | null } | null; attachmentLeft: boolean }) {
  return [
    result.recipient
      ? `Prospect : ${result.recipient.displayName ?? result.recipient.email}. Le suivi démarre à l'envoi.`
      : "Le suivi démarre à l'envoi, avec le destinataire de l'email.",
    result.attachmentLeft ? "Pensez à retirer la pièce jointe." : null,
  ]
    .filter(Boolean)
    .join(" ");
}
