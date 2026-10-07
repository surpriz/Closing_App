import { browser } from "wxt/browser";

// How the link looks in the email: a framed card, or a plain line of text
export type LinkStyle = "card" | "text";

const KEY = "linkStyle";

export async function getLinkStyle(): Promise<LinkStyle> {
  const stored = await browser.storage.local.get(KEY);
  return stored[KEY] === "text" ? "text" : "card";
}

export function setLinkStyle(style: LinkStyle) {
  return browser.storage.local.set({ [KEY]: style });
}
