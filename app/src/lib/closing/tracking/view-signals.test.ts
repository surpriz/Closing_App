import { describe, expect, it } from "vitest";

import { MAX_EXTERNAL_AWAY_MS, signalDetail, signalValue } from "./view-signals";

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

describe("signalDetail", () => {
  it("keeps the language of a translation", () => {
    expect(signalDetail("TRANSLATED", "de")).toBe("de");
  });

  it("drops a translation into a language we do not offer", () => {
    expect(signalDetail("TRANSLATED", "xx")).toBeUndefined();
    expect(signalDetail("TRANSLATED", undefined)).toBeUndefined();
  });

  it("keeps nothing on the other signals", () => {
    expect(signalDetail("DOWNLOAD", "de")).toBeNull();
  });
});

describe("copied text", () => {
  it("keeps the number of characters, not a misclick", () => {
    expect(signalValue("COPY_TEXT", 240)).toBe(240);
    expect(signalValue("COPY_TEXT", 5)).toBeUndefined();
  });

  it("keeps the page it came from", () => {
    expect(signalDetail("COPY_TEXT", "4")).toBe("4");
    expect(signalDetail("COPY_TEXT", "page")).toBeNull();
  });
});
