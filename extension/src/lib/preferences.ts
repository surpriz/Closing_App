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
