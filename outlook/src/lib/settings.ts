// Roaming settings: stored in the mailbox, so the token follows the seller on every
// Outlook they use, and both the pane and the event runtime can read it.
export type SettingsStore = {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  remove(name: string): void;
  save(): Promise<void>;
};

export function roamingStore(): SettingsStore {
  const settings = Office.context.roamingSettings;
  return {
    get: (name) => settings.get(name),
    set: (name, value) => settings.set(name, value),
    remove: (name) => settings.remove(name),
    save: () =>
      new Promise((resolve, reject) =>
        settings.saveAsync((result) =>
          result.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(new Error(result.error?.message)),
        ),
      ),
  };
}

let store: SettingsStore | null = null;

export function settingsStore() {
  return (store ??= roamingStore());
}

// Tests swap in a memory store
export function useSettingsStore(next: SettingsStore | null) {
  store = next;
}

const TOKEN = "clozerToken";
const LINK_STYLE = "clozerLinkStyle";
const ASK_FIRST = "clozerAskFirst";

export function getToken() {
  const value = settingsStore().get(TOKEN);
  return typeof value === "string" && value ? value : null;
}

export async function setToken(token: string | null) {
  const store = settingsStore();
  if (token) store.set(TOKEN, token);
  else store.remove(TOKEN);
  await store.save();
}

export function getLinkStyle(): "card" | "text" {
  return settingsStore().get(LINK_STYLE) === "text" ? "text" : "card";
}

export async function setLinkStyle(style: "card" | "text") {
  settingsStore().set(LINK_STYLE, style);
  await settingsStore().save();
}

// Attached PDFs are replaced right away unless the seller asked to be asked first
export function getAskFirst() {
  return settingsStore().get(ASK_FIRST) === true;
}

export async function setAskFirst(askFirst: boolean) {
  settingsStore().set(ASK_FIRST, askFirst);
  await settingsStore().save();
}
