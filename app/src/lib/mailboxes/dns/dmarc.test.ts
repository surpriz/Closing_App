import { describe, expect, it } from "vitest";

import { parseDmarc } from "./dmarc";

describe("parseDmarc", () => {
  it("reads policy and rua", () => {
    expect(parseDmarc(["v=DMARC1; p=Reject; rua=mailto:d@acme.fr"])).toEqual({ present: true, policy: "reject", rua: "mailto:d@acme.fr" });
  });
  it("handles none and absence", () => {
    expect(parseDmarc(["v=DMARC1; p=none"])).toEqual({ present: true, policy: "none", rua: null });
    expect(parseDmarc(["foo"])).toEqual({ present: false, policy: null, rua: null });
  });
});
