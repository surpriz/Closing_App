import { addLink, parseLinks, type InsertedLink } from "./compose";
import { officeCall } from "./office";

const KEY = "clozerLinks";

// sessionData (Mailbox 1.11) lives as long as this compose window, and both the pane
// and the send handler see it. Older clients don't have it: the first prospect open
// confirms the link instead, as in the app.
function sessionData(item: Office.MessageCompose) {
  return (item as Office.MessageCompose & { sessionData?: Office.SessionData }).sessionData ?? null;
}

export async function readLinks(item: Office.MessageCompose) {
  const data = sessionData(item);
  if (!data) return [];
  const value = await officeCall<string>((callback) => data.getAsync(KEY, callback)).catch(() => null);
  return parseLinks(value);
}

export async function rememberLink(item: Office.MessageCompose, link: InsertedLink) {
  const data = sessionData(item);
  if (!data) return;
  const links = addLink(await readLinks(item), link);
  await officeCall<void>((callback) => data.setAsync(KEY, JSON.stringify(links), callback)).catch(() => undefined);
}

export async function forgetLinks(item: Office.MessageCompose) {
  const data = sessionData(item);
  if (!data) return;
  await officeCall<void>((callback) => data.removeAsync(KEY, callback)).catch(() => undefined);
}
