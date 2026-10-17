import type { UiLocale } from "@/i18n/locale";
import { getTranslator } from "@/i18n/messages";
import { SIGNUP_REFUSAL_CODES, type SignupRefusal } from "@/lib/platform-admin";

/**
 * Sign-in refusals in the reader's language. Server only: platform-admin.ts
 * keeps the codes and stays importable from the browser.
 */

// Codes Better Auth puts in ?error= when a magic link fails, as the login page shows them
const LOGIN_ERROR_CODES = ["SIGNUP_BLOCKED", "SIGNUP_CLOSED", "BANNED_USER", "INVALID_TOKEN", "EXPIRED_TOKEN"] as const;
type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

function isLoginErrorCode(code: string): code is LoginErrorCode {
  return (LOGIN_ERROR_CODES as readonly string[]).includes(code);
}

export function bannedUserMessage(locale: UiLocale) {
  return getTranslator(locale)("server.login.BANNED_USER");
}

export function signupRefusalMessage(refusal: SignupRefusal, locale: UiLocale) {
  return getTranslator(locale)(`server.login.${SIGNUP_REFUSAL_CODES[refusal] as "SIGNUP_BLOCKED" | "SIGNUP_CLOSED"}`);
}

export function loginErrorMessage(code: string | undefined, locale: UiLocale) {
  if (!code) return null;
  const t = getTranslator(locale);
  return isLoginErrorCode(code) ? t(`server.login.${code}`) : t("server.login.fallback");
}
