import { browser } from "wxt/browser";

import type { LinkStyle } from "./link-html";

export type { LinkStyle };

const KEY = "linkStyle";

export async function getLinkStyle(): Promise<LinkStyle> {
  const stored = await browser.storage.local.get(KEY);
  return stored[KEY] === "text" ? "text" : "card";
}

export function setLinkStyle(style: LinkStyle) {
  return browser.storage.local.set({ [KEY]: style });
}

const ASK_FIRST_KEY = "askFirst";

/** Off by default: an attached PDF becomes a link without a question. */
export async function getAskFirst() {
  const stored = await browser.storage.local.get(ASK_FIRST_KEY);
  return stored[ASK_FIRST_KEY] === true;
}

export function setAskFirst(askFirst: boolean) {
  return browser.storage.local.set({ [ASK_FIRST_KEY]: askFirst });
}
