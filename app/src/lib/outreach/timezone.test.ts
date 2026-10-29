import { describe, expect, it } from "vitest";

import { COUNTRY_TIMEZONES, detectCountryTimezone } from "./timezone";

const FALLBACK = "Europe/Paris";

describe("detectCountryTimezone", () => {
  it("keeps a valid IANA zone", () => {
    expect(detectCountryTimezone("America/Chicago", FALLBACK)).toBe("America/Chicago");
  });

  it("maps ISO codes, any case", () => {
    expect(detectCountryTimezone("US", FALLBACK)).toBe("America/New_York");
    expect(detectCountryTimezone("ca", FALLBACK)).toBe("America/Toronto");
    expect(detectCountryTimezone(" au ", FALLBACK)).toBe("Australia/Sydney");
    expect(detectCountryTimezone("GB", FALLBACK)).toBe("Europe/London");
  });

  it("maps FR and EN country names with accents", () => {
    expect(detectCountryTimezone("Belgique", FALLBACK)).toBe("Europe/Brussels");
    expect(detectCountryTimezone("Switzerland", "UTC")).toBe("Europe/Zurich");
    expect(detectCountryTimezone("États-Unis", FALLBACK)).toBe("America/New_York");
    expect(detectCountryTimezone("etats-unis", FALLBACK)).toBe("America/New_York");
    expect(detectCountryTimezone("Côte d'Ivoire", FALLBACK)).toBe("Africa/Abidjan");
    expect(detectCountryTimezone("Israël", FALLBACK)).toBe("Asia/Jerusalem");
    expect(detectCountryTimezone("Pays-Bas", FALLBACK)).toBe("Europe/Amsterdam");
    expect(detectCountryTimezone("UK", "UTC")).toBe("Europe/London");
    expect(detectCountryTimezone("Émirats", "UTC")).toBe("Asia/Dubai");
  });

  it("falls back when unknown or empty", () => {
    expect(detectCountryTimezone("Atlantis", FALLBACK)).toBe(FALLBACK);
    expect(detectCountryTimezone("", FALLBACK)).toBe(FALLBACK);
    expect(detectCountryTimezone(null, FALLBACK)).toBe(FALLBACK);
    expect(detectCountryTimezone(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("exposes a table of valid zones", () => {
    for (const zone of Object.values(COUNTRY_TIMEZONES)) {
      expect(() => new Intl.DateTimeFormat(undefined, { timeZone: zone })).not.toThrow();
    }
  });
});
