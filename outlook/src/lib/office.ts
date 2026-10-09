// Office.js callbacks as promises
export function officeCall<T>(start: (callback: (result: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise((resolve, reject) =>
    start((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve(result.value);
      else reject(new Error(result.error?.message ?? "Outlook n'a pas pu traiter la demande."));
    }),
  );
}

export function mailbox() {
  return Office.context.mailbox;
}

export function supports(version: string) {
  return Office.context.requirements.isSetSupported("Mailbox", version);
}

// A message being written (vs read): only then can we touch attachments and body
export function composeItem(): Office.MessageCompose | null {
  const item = mailbox().item as (Office.MessageCompose & Office.MessageRead) | null | undefined;
  if (!item || item.itemType !== Office.MailboxEnums.ItemType.Message) return null;
  return typeof (item as Office.MessageCompose).body?.setSelectedDataAsync === "function" &&
    typeof (item as Office.MessageCompose).to?.getAsync === "function"
    ? item
    : null;
}

// Pages and alerts open in the seller's browser, where they are signed in to Clozer
export function openInBrowser(url: string) {
  const ui = Office.context.ui as Office.UI & { openBrowserWindow?: (url: string) => void };
  if (typeof ui?.openBrowserWindow === "function") {
    try {
      ui.openBrowserWindow(url);
      return;
    } catch {
      // older clients: fall through
    }
  }
  window.open(url, "_blank", "noopener");
}
