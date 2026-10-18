import { describe, expect, it } from "vitest";

import { sellerStage } from "./seller-stage";

describe("sellerStage", () => {
  it("starts empty", () => {
    expect(sellerStage({ documents: 0, sent: 0, read: 0 })).toBe("empty");
  });

  it("waits for a first link once a document is in", () => {
    expect(sellerStage({ documents: 1, sent: 0, read: 0 })).toBe("unsent");
  });

  it("waits for a first reading once a link went out", () => {
    expect(sellerStage({ documents: 1, sent: 1, read: 0 })).toBe("waiting");
  });

  it("is reading as soon as one link was opened, even with every document archived", () => {
    expect(sellerStage({ documents: 0, sent: 1, read: 1 })).toBe("reading");
  });
});
