import { describe, expect, it } from "vitest";

import { clipAtWord, tidyEllipsis } from "./clip-text";

describe("clipAtWord", () => {
  it("keeps short text as is, spaces normalised", () => {
    expect(clipAtWord("  Marie  relit  ", 20)).toBe("Marie relit");
  });

  it("ends on a whole word", () => {
    expect(clipAtWord("et un second lecteur vient de rouvrir le devis", 30)).toBe("et un second lecteur vient…");
  });

  it("still cuts one long word", () => {
    expect(clipAtWord("x".repeat(50), 10)).toBe(`${"x".repeat(9)}…`);
  });
});

describe("tidyEllipsis", () => {
  it("drops a half word left by an older clip", () => {
    expect(tidyEllipsis("un second lecteur vient d…")).toBe("un second lecteur vient…");
  });

  it("leaves text without ellipsis alone", () => {
    expect(tidyEllipsis("Marie relit les tarifs")).toBe("Marie relit les tarifs");
  });
});
