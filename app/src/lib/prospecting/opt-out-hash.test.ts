import { describe, expect, it } from "vitest";

import { optOutKeys, personHash } from "./opt-out-hash";

describe("optOutKeys", () => {
  it("gives the same hash for the same person written differently", () => {
    const [a] = optOutKeys({ email: " Marie@Acme.fr " });
    const [b] = optOutKeys({ email: "marie@acme.fr" });
    expect(a).toEqual(b);
    expect(a.valueHash).not.toContain("acme");
  });

  it("covers every identifier given", () => {
    const keys = optOutKeys({
      email: "marie@acme.fr",
      linkedinUrl: "https://www.linkedin.com/in/marie/",
      provider: "APOLLO",
      externalId: "abc",
      personHash: personHash("marie|d|acme"),
    });
    expect(keys.map((k) => k.kind)).toEqual(["EMAIL", "LINKEDIN", "PROVIDER_ID", "PERSON"]);
    expect(keys[3].valueHash).not.toContain("marie");
    expect(optOutKeys({})).toEqual([]);
  });
});
