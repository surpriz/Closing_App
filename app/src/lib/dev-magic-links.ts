import { isEmailConfigured } from "@/lib/email";

// Local dev without an email provider: magic links are kept in memory and shown
// on the login page instead of being emailed. Never active in production.
const store = globalThis as unknown as { __devMagicLinks?: Map<string, string> };
const links = (store.__devMagicLinks ??= new Map<string, string>());

export function devMagicLinksEnabled() {
  return process.env.NODE_ENV === "development" && !isEmailConfigured();
}

export function rememberDevMagicLink(email: string, url: string) {
  links.set(email.toLowerCase(), url);
}

export function takeDevMagicLink(email: string) {
  const key = email.toLowerCase();
  const url = links.get(key) ?? null;
  links.delete(key);
  return url;
}
