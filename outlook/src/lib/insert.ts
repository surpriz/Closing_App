import { COPY } from "@ext/copy";
import { waitForTitle } from "@ext/title-wait";

import type { DocumentSummary } from "./api";
import { base64ToBytes, firstRecipient, type AttachmentInfo } from "./compose";
import { createLink, ensureDocument, getDocument, linkContent } from "./documents";
import { ClozerError } from "./errors";
import { rememberLink } from "./links-store";
import { officeCall } from "./office";
import { getLinkStyle } from "./settings";

// The whole "PDF → Clozer link" job, shared by the pane and the attachment event.
// `step` reports progress in the seller's words.

export const NOTICE_KEY = "clozer-pdf";

type Step = (text: string) => void;

export async function replaceAttachment(compose: Office.MessageCompose, attachment: AttachmentInfo, step: Step) {
  step(COPY.readingAttachment);
  const content = await officeCall<Office.AttachmentContent>((callback) => compose.getAttachmentContentAsync(attachment.id, callback));
  if (content.format !== Office.MailboxEnums.AttachmentContentFormat.Base64) {
    throw new ClozerError("format", COPY.unreadableAttachment);
  }
  const document = await ensureDocument(base64ToBytes(content.content), attachment.name, (percent) =>
    step(COPY.uploadingPercent(percent)),
  );
  return insertDocument(compose, document, step, attachment.id);
}

// Link for this email (first "To" recipient = prospect), inserted where the seller was typing
export async function insertDocument(compose: Office.MessageCompose, document: DocumentSummary, step: Step, attachmentId?: string) {
  // The AI title lands a few seconds after upload: the link then carries it instead of the file name
  document = (await waitForTitle(() => getDocument(document.id), { initial: document, onWait: () => step(COPY.naming) })) ?? document;
  step(COPY.creatingLink);
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
      throw new ClozerError("insert", COPY.insertFailed(link.url));
    });
  }
  await rememberLink(compose, {
    id: link.id,
    url: link.url,
    title: link.title,
    summary: link.summary,
    manageUrl: link.manageUrl,
  });

  let attachmentLeft = false;
  if (attachmentId) {
    attachmentLeft = await officeCall<void>((callback) => compose.removeAttachmentAsync(attachmentId, callback)).then(
      () => false,
      () => true,
    );
  }
  return { link, recipient, attachmentLeft };
}

// What the seller reads once the link is in: only what is left to do
export function insertedNote(result: { attachmentLeft: boolean }) {
  return result.attachmentLeft ? COPY.removeAttachment : "";
}
