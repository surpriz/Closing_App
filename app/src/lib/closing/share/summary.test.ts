import { describe, expect, it } from "vitest";

import { settingsSummary } from "./summary";

const now = new Date("2026-10-10T10:00:00Z");
const base = { shared: false, requireEmail: true, expiresAt: null, ctaEnabled: true, chatEnabled: false, followupsEnabled: true };

describe("settingsSummary", () => {
  it("sums up a personal quote", () => {
    expect(settingsSummary({ ...base, expiresAt: new Date("2026-10-25T09:00:00Z") }, now)).toEqual([
      "Email demandé",
      "Expire dans 15 j",
      "Validation en ligne",
      "Relances auto",
    ]);
  });

  it("says a shared link gives each reader their own link and reviewed follow-ups", () => {
    expect(settingsSummary({ ...base, shared: true, ctaEnabled: false }, now)).toEqual([
      "Un lien par lecteur",
      "Sans expiration",
      "Relances à valider",
    ]);
  });
});
