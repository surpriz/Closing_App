import { describe, expect, it } from "vitest";

import { followupsEmptyHint } from "./empty-hint";

const base = { campaign: null, followupsEnabled: true, shared: false, hasEmail: true };

describe("followupsEmptyHint", () => {
  it("names the campaign that drives the link first", () => {
    expect(followupsEmptyHint({ ...base, campaign: "Waltio", followupsEnabled: false })).toBe("emptyHintCampaign");
  });

  it("says follow-ups are off for the link", () => {
    expect(followupsEmptyHint({ ...base, followupsEnabled: false, hasEmail: false })).toBe("emptyHintOff");
  });

  it("never asks a Smart Link owner to add a contact: readers add themselves", () => {
    expect(followupsEmptyHint({ ...base, shared: true, hasEmail: false })).toBe("emptyHintShared");
  });

  it("asks for the prospect's email on a personal link without one", () => {
    expect(followupsEmptyHint({ ...base, hasEmail: false })).toBe("emptyHintNoEmail");
  });

  it("keeps the default hint when nothing is in the way", () => {
    expect(followupsEmptyHint(base)).toBeNull();
  });
});
