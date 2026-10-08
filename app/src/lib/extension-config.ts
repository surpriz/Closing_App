import { getEnv } from "@/lib/env";

function list(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

// Extensions allowed to receive a token from /extension/connect
export function allowedExtensionIds() {
  return list(getEnv().EXTENSION_IDS);
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
