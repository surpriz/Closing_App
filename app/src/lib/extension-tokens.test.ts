import { describe, expect, it } from "vitest";

import { generateExtensionToken, hashExtensionToken, parseBearer, tokenHint } from "./extension-tokens";

describe("extension tokens", () => {
  it("generates distinct prefixed tokens", () => {
    const a = generateExtensionToken();
    expect(a).toMatch(/^clz_ext_[A-Za-z0-9_-]{43}$/);
    expect(generateExtensionToken()).not.toBe(a);
  });

  it("hashes deterministically", () => {
    const token = generateExtensionToken();
    expect(hashExtensionToken(token)).toBe(hashExtensionToken(token));
    expect(hashExtensionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps the last four characters as hint", () => {
    expect(tokenHint("clz_ext_abcd")).toBe("abcd");
  });

  it("parses a bearer header", () => {
    const token = generateExtensionToken();
    expect(parseBearer(`Bearer ${token}`)).toBe(token);
    expect(parseBearer(`bearer  ${token} `)).toBe(token);
  });

  it("rejects anything else", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Bearer nope")).toBeNull();
    expect(parseBearer(generateExtensionToken())).toBeNull();
    expect(parseBearer(`Basic ${generateExtensionToken()}`)).toBeNull();
  });
});
