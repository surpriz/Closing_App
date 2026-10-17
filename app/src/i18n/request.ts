import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { getSession } from "@/lib/session";

import { LOCALE_COOKIE, resolveUiLocale } from "./locale";
import { MESSAGES } from "./messages";

export default getRequestConfig(async () => {
  const [session, cookieStore, headerStore] = await Promise.all([getSession(), cookies(), headers()]);
  const locale = resolveUiLocale({
    saved: session?.user.locale,
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  return { locale, messages: MESSAGES[locale] };
});
