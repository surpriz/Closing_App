import { getEnv } from "@/lib/env";
import { connectedClients } from "@/lib/extension-tokens";
import type { ExtensionProbe } from "@/lib/onboarding";

function list(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

// Extensions allowed to receive a token from /extension/connect
/**
 * The Chrome Web Store build. Its ID is public and never changes, so it does not
 * hang on EXTENSION_IDS: an empty variable once cut every seller off.
 */
export const STORE_EXTENSION_ID = "fnefeeodeepechnhbijpfmjjcolopmmj";
export const STORE_EXTENSION_URL = `https://chromewebstore.google.com/detail/clozer/${STORE_EXTENSION_ID}`;

/** The store build, plus the dev and staging builds listed in EXTENSION_IDS. */
export function extensionIdsFrom(value: string | undefined) {
  return [...new Set([STORE_EXTENSION_ID, ...list(value)])];
}

export function allowedExtensionIds() {
  return extensionIdsFrom(getEnv().EXTENSION_IDS);
}

// Lets us switch off a broken mail adapter without waiting for a store review
export function extensionRemoteConfig() {
  const env = getEnv();
  return {
    minVersion: env.EXTENSION_MIN_VERSION ?? null,
    disabledHosts: list(env.EXTENSION_DISABLED_HOSTS),
    notificationsEnabled: env.EXTENSION_NOTIFICATIONS_DISABLED !== "true",
  };
}

// What a page needs to ask this browser's extension where it stands
export function extensionProbe(userEmail: string, tokens: { label: string | null }[]): ExtensionProbe {
  return {
    ids: allowedExtensionIds(),
    minVersion: getEnv().EXTENSION_MIN_VERSION ?? null,
    userEmail,
    serverChrome: connectedClients(tokens).chrome,
  };
}
