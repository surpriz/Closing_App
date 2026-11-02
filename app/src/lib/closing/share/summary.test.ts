import { describe, expect, it } from "vitest";

import { settingsSummary } from "./summary";

const now = new Date("2026-10-10T10:00:00Z");
const base = { shared: false, requireEmail: true, expiresAt: null, ctaEnabled: true, chatEnabled: false, followupsEnabled: true };

describe("settingsSummary", () => {
  it("sums up a personal quote, with follow-ups waiting for the seller by default", () => {
    expect(settingsSummary({ ...base, expiresAt: new Date("2026-10-25T09:00:00Z") }, now, "fr")).toEqual([
      "Email demandé",
      "Expire dans 15 j",
      "Validation en ligne",
      "Relances à valider",
    ]);
  });

  it("says follow-ups go out alone only on Autopilot", () => {
    expect(settingsSummary(base, now, "fr", { autonomy: "AUTOPILOT" })).toEqual([
      "Email demandé",
      "Sans expiration",
      "Validation en ligne",
      "Relances automatiques (Pilote)",
    ]);
  });

  it("keeps a shared link's follow-ups under review even on Autopilot", () => {
    expect(settingsSummary({ ...base, shared: true, ctaEnabled: false }, now, "fr", { autonomy: "AUTOPILOT" })).toEqual([
      "Un lien par lecteur",
      "Sans expiration",
      "Relances à valider",
    ]);
  });

  it("names the campaign that drives the follow-ups, even when the link's own switch is off", () => {
    expect(settingsSummary({ ...base, followupsEnabled: false }, now, "fr", { campaign: "Onboarding Waltio" })).toEqual([
      "Email demandé",
      "Sans expiration",
      "Validation en ligne",
      "Relances : campagne Onboarding Waltio",
    ]);
  });

  it("says follow-ups are off", () => {
    expect(settingsSummary({ ...base, followupsEnabled: false }, now, "fr")).toEqual([
      "Email demandé",
      "Sans expiration",
      "Validation en ligne",
      "Relances coupées",
    ]);
  });

  it("speaks English too", () => {
    expect(settingsSummary({ ...base, chatEnabled: true }, now, "en", { autonomy: "AUTOPILOT" })).toEqual([
      "Email required",
      "No expiry",
      "Online approval",
      "AI assistant",
      "Auto follow-ups (Autopilot)",
    ]);
  });
});
