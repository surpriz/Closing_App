import { createTranslator } from "next-intl";

import en_common from "../../messages/en/common.json";
import en_meta from "../../messages/en/meta.json";
import en_nav from "../../messages/en/nav.json";
import en_today from "../../messages/en/today.json";
import en_labels from "../../messages/en/labels.json";
import en_deal from "../../messages/en/deal.json";
import en_documents from "../../messages/en/documents.json";
import en_team from "../../messages/en/team.json";
import en_settings from "../../messages/en/settings.json";
import en_prospecting from "../../messages/en/prospecting.json";
import en_help from "../../messages/en/help.json";
import en_onboarding from "../../messages/en/onboarding.json";
import en_auth from "../../messages/en/auth.json";
import en_emails from "../../messages/en/emails.json";
import en_alerts from "../../messages/en/alerts.json";
import en_server from "../../messages/en/server.json";
import en_results from "../../messages/en/results.json";
import fr_common from "../../messages/fr/common.json";
import fr_meta from "../../messages/fr/meta.json";
import fr_nav from "../../messages/fr/nav.json";
import fr_today from "../../messages/fr/today.json";
import fr_labels from "../../messages/fr/labels.json";
import fr_deal from "../../messages/fr/deal.json";
import fr_documents from "../../messages/fr/documents.json";
import fr_team from "../../messages/fr/team.json";
import fr_settings from "../../messages/fr/settings.json";
import fr_prospecting from "../../messages/fr/prospecting.json";
import fr_help from "../../messages/fr/help.json";
import fr_onboarding from "../../messages/fr/onboarding.json";
import fr_auth from "../../messages/fr/auth.json";
import fr_emails from "../../messages/fr/emails.json";
import fr_alerts from "../../messages/fr/alerts.json";
import fr_server from "../../messages/fr/server.json";
import fr_results from "../../messages/fr/results.json";

import type { UiLocale } from "./locale";

// One file per namespace and language, so areas of the app can be translated independently.
const en = {
  common: en_common,
  meta: en_meta,
  nav: en_nav,
  today: en_today,
  labels: en_labels,
  deal: en_deal,
  documents: en_documents,
  team: en_team,
  settings: en_settings,
  prospecting: en_prospecting,
  help: en_help,
  onboarding: en_onboarding,
  auth: en_auth,
  emails: en_emails,
  alerts: en_alerts,
  server: en_server,
  results: en_results,
};

const fr = {
  common: fr_common,
  meta: fr_meta,
  nav: fr_nav,
  today: fr_today,
  labels: fr_labels,
  deal: fr_deal,
  documents: fr_documents,
  team: fr_team,
  settings: fr_settings,
  prospecting: fr_prospecting,
  help: fr_help,
  onboarding: fr_onboarding,
  auth: fr_auth,
  emails: fr_emails,
  alerts: fr_alerts,
  server: fr_server,
  results: fr_results,
};

export type Messages = typeof en;

export const MESSAGES: Record<UiLocale, Messages> = { en, fr };

/**
 * Translator for server code that runs outside a request (Trigger.dev tasks,
 * emails, alerts). Inside a request, use getTranslations / useTranslations.
 * Never import this from code that reaches the browser: it bundles every message.
 */
export function getTranslator(locale: UiLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}
