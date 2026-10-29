import { describe, expect, it } from "vitest";

import { decodeCsv } from "./decode";

const bytes = (...values: number[]) => Uint8Array.from(values).buffer;
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

describe("decodeCsv", () => {
  it("keeps valid UTF-8 as is (the BOM is dropped)", () => {
    expect(decodeCsv(bytes(...new TextEncoder().encode("\uFEFFemail;prénom")))).toBe("email;prénom");
  });

  it("reads Excel for Mac's Mac Roman", () => {
    // é is 0x8E in Mac Roman (Ž in Windows-1252)
    expect(decodeCsv(bytes(...ascii("email;pr"), 0x8e, ...ascii("nom;soci"), 0x8e, ...ascii("t"), 0x8e))).toBe("email;prénom;société");
  });

  it("reads Excel for Windows' Windows-1252", () => {
    // é is 0xE9 in Windows-1252 (È in Mac Roman)
    expect(decodeCsv(bytes(...ascii("email;pr"), 0xe9, ...ascii("nom;soci"), 0xe9, ...ascii("t"), 0xe9))).toBe("email;prénom;société");
  });
});
