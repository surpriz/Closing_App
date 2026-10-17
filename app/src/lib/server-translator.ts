import { createTranslator, type NamespaceKeys, type NestedKeyOf } from "next-intl";

import type { UiLocale } from "@/i18n/locale";
import { MESSAGES, type Messages } from "@/i18n/messages";

/**
 * getTranslator scoped to one namespace, for server code outside a request
 * (emails, alerts, background jobs). Server only, like @/i18n/messages.
 */
export type ServerNamespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

export function getNamespaceTranslator<const NS extends ServerNamespace>(locale: UiLocale, namespace: NS) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace });
}

export type ServerT<NS extends ServerNamespace> = ReturnType<typeof getNamespaceTranslator<NS>>;
