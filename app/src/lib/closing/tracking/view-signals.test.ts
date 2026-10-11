import { describe, expect, it } from "vitest";

import { MAX_EXTERNAL_AWAY_MS, signalValue } from "./view-signals";

describe("signalValue", () => {
  it("keeps no value on plain signals", () => {
    expect(signalValue("EXTERNAL_OPEN", 5000)).toBeNull();
    expect(signalValue("DOWNLOAD", undefined)).toBeNull();
  });

  it("caps the time away", () => {
    expect(signalValue("EXTERNAL_RETURN", 61_234.4)).toBe(61_234);
    expect(signalValue("EXTERNAL_RETURN", 5 * 60 * 60 * 1000)).toBe(MAX_EXTERNAL_AWAY_MS);
  });

  it("drops a glance at the other tab", () => {
    expect(signalValue("EXTERNAL_RETURN", 1500)).toBeUndefined();
    expect(signalValue("EXTERNAL_RETURN", undefined)).toBeUndefined();
  });
});
