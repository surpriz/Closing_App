import type { useTranslations } from "next-intl";

export type ProspectingLabelsT = ReturnType<typeof useTranslations<"prospecting.labels">>;

// Brand names stay as they are; only the demo provider has a translated name
const PROVIDER_NAMES: Record<string, string> = { APOLLO: "Apollo", LEMLIST: "Lemlist" };

export function providerLabel(t: ProspectingLabelsT, provider: string) {
  if (provider === "MOCK") return t("provider.MOCK");
  return PROVIDER_NAMES[provider] ?? provider;
}

export function statusLabel(t: ProspectingLabelsT, status: string) {
  return t.has(`status.${status}` as never) ? t(`status.${status}` as never) : status;
}

export function invalidLabel(t: ProspectingLabelsT, reason: string) {
  return t.has(`invalid.${reason}` as never) ? t(`invalid.${reason}` as never) : reason;
}
