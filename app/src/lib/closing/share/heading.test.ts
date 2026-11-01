import { describe, expect, it } from "vitest";

import { shareHeading } from "./heading";

const base = { sent: false, shared: false, wasCopied: false, opened: false, hasRecipient: false };

describe("shareHeading", () => {
  it("says the link is ready before anything happened", () => {
    expect(shareHeading(base)).toBe("ready");
  });

  it("says it was copied once the seller copied it", () => {
    expect(shareHeading({ ...base, wasCopied: true })).toBe("linkCopied");
  });

  it("asks who the link is for when a reader opened it before a recipient was named", () => {
    expect(shareHeading({ ...base, sent: true, opened: true })).toBe("openedNoRecipient");
  });

  it("says it went out when sent to a named recipient", () => {
    expect(shareHeading({ ...base, sent: true, opened: true, hasRecipient: true })).toBe("sentPersonal");
    expect(shareHeading({ ...base, sent: true })).toBe("sentPersonal");
  });

  it("says a Smart Link is live, whoever opened it", () => {
    expect(shareHeading({ ...base, sent: true, shared: true, opened: true })).toBe("liveShared");
  });
});
