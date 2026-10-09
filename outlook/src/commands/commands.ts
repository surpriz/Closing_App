import { api, type Account } from "../lib/api";
import { debug } from "../lib/debug";
import { firstRecipient, linksInBody, type AttachmentInfo } from "../lib/compose";
import { KILL_SWITCH_HOST } from "../lib/config";
import { insertedNote, NOTICE_KEY, replaceAttachment } from "../lib/insert";
import { readLinks } from "../lib/links-store";
import { officeCall } from "../lib/office";
import { getAskFirst, getToken } from "../lib/settings";
import { attachmentNotice, failedMessage, replacedMessage } from "./notice";

// Event handlers. An attached PDF is replaced right here, pane closed, with the
// progress and the outcome in Outlook's bar above the email.
// Classic Outlook on Windows runs this file alone (no DOM, no localStorage).

type LaunchEvent = { completed(options?: { allowEvent?: boolean }): void };
type AttachmentsEvent = LaunchEvent & { attachmentDetails?: AttachmentInfo; attachmentStatus?: string };

// Must match the compose button id in the manifest: the notice action opens that pane
const COMPOSE_BUTTON = "msgComposeOpenPaneButton";
// Outlook shows "Clozer is taking longer than expected" after a few seconds: give up well
// before. keepalive lets the confirmation finish on its own after the email has left.
const SEND_TIMEOUT_MS = 2_500;

function item() {
  return Office.context.mailbox.item as Office.MessageCompose;
}

function showNotice(details: Office.NotificationMessageDetails) {
  const messages = item().notificationMessages;
  return officeCall<void>((callback) => messages.replaceAsync(NOTICE_KEY, details, callback)).catch(() => undefined);
}

// Removing the PDF ourselves fires "removed" too: only a pending question goes away,
// never the progress or the outcome of a replacement
async function clearQuestion() {
  const messages = item().notificationMessages;
  const current = await officeCall<Office.NotificationMessageDetails[]>((callback) => messages.getAllAsync(callback)).catch(() => []);
  const question = current.find((message) => message.key === NOTICE_KEY && message.type === Office.MailboxEnums.ItemNotificationMessageType.InsightMessage);
  if (question) await officeCall<void>((callback) => messages.removeAsync(NOTICE_KEY, callback)).catch(() => undefined);
}

async function replaceNow(attachment: AttachmentInfo, progress: string) {
  debug("replace start", attachment.name);
  await showNotice({ type: Office.MailboxEnums.ItemNotificationMessageType.ProgressIndicator, message: progress });
  try {
    const me = await api<Account>("/api/ext/me");
    if (me.disabledHosts.includes(KILL_SWITCH_HOST)) {
      await officeCall<void>((callback) => item().notificationMessages.removeAsync(NOTICE_KEY, callback)).catch(() => undefined);
      return;
    }
    const result = await replaceAttachment(item(), attachment, (text) => debug("step", text));
    debug("replace done", result.link.url, "attachmentLeft", result.attachmentLeft);
    await showNotice({
      type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
      message: replacedMessage(attachment.name, insertedNote(result)),
      icon: "Icon.16",
      persistent: false,
    });
  } catch (error) {
    debug("replace failed", error);
    const reason = error instanceof Error && error.message ? error.message : "erreur inattendue.";
    await showNotice({ type: Office.MailboxEnums.ItemNotificationMessageType.ErrorMessage, message: failedMessage(attachment.name, reason) });
  }
}

async function onAttachmentsChanged(event: AttachmentsEvent) {
  debug("onAttachmentsChanged", event.attachmentStatus, event.attachmentDetails, "token", !!getToken(), "askFirst", getAskFirst());
  try {
    const notice = attachmentNotice(event.attachmentDetails, String(event.attachmentStatus ?? ""), !!getToken(), getAskFirst());
    if (notice.kind === "clear") {
      await clearQuestion();
    } else if (notice.kind === "replace") {
      await replaceNow(notice.attachment, notice.progress);
    } else if (notice.kind === "show") {
      await showNotice({
        type: Office.MailboxEnums.ItemNotificationMessageType.InsightMessage,
        message: notice.message,
        icon: "Icon.16",
        actions: [
          {
            actionType: Office.MailboxEnums.ActionType.ShowTaskPane,
            actionText: notice.actionText,
            commandId: COMPOSE_BUTTON,
            contextData: JSON.stringify(notice.attachmentId ? { attachmentId: notice.attachmentId } : {}),
          },
        ],
      });
    }
  } catch (error) {
    debug("attachments handler failed", error);
    console.error("[clozer]", error);
  } finally {
    event.completed();
  }
}

// The links inserted in this email become deals. Never blocks the send: whatever
// happens, the email leaves, and the first prospect open confirms the link otherwise.
async function onMessageSend(event: LaunchEvent) {
  debug("onMessageSend");
  try {
    const compose = item();
    const links = await readLinks(compose);
    debug("send links", links, "token", !!getToken());
    if (links.length && getToken()) {
      const [body, to] = await Promise.all([
        officeCall<string>((callback) => compose.body.getAsync(Office.CoercionType.Html, callback)).catch(() => null),
        officeCall<Office.EmailAddressDetails[]>((callback) => compose.to.getAsync(callback)).catch(() => []),
      ]);
      const sent = body === null ? links : linksInBody(links, body);
      const recipient = firstRecipient(to);
      await Promise.race([
        Promise.allSettled(
          sent.map((link) => api(`/api/ext/links/${encodeURIComponent(link.id)}/sent`, { body: { recipient }, keepalive: true })),
        ),
        new Promise((resolve) => setTimeout(resolve, SEND_TIMEOUT_MS)),
      ]);
    }
  } catch (error) {
    debug("send failed", error);
    console.error("[clozer]", error);
  } finally {
    debug("send completed");
    event.completed({ allowEvent: true });
  }
}

debug("commands loaded", typeof Office !== "undefined" ? "Office present" : "no Office");

if (typeof Office !== "undefined") {
  // HTML runtimes (Mac, new Outlook, web) only hand events over once the page has
  // told Office.js it is ready. Classic Windows' JavaScript-only runtime doesn't need it.
  void Office.onReady((info) =>
    debug("office ready", info?.host, info?.platform, Office.context?.diagnostics?.version, Office.context?.requirements?.isSetSupported("Mailbox", "1.13")),
  );
  Office.actions.associate("onAttachmentsChanged", onAttachmentsChanged);
  Office.actions.associate("onMessageSend", onMessageSend);
}
