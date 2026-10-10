import { describe, expect, it } from "vitest";

import { SIGNER_NAME } from "./signed-email";

describe("SIGNER_NAME", () => {
  it("takes real names", () => {
    for (const name of ["Marie Martin", "Jean-Luc O'Neil", "Éloïse", "Zoë Ng"]) expect(SIGNER_NAME.test(name)).toBe(true);
  });

  it("refuses anything a mail client could turn into a link", () => {
    for (const name of ["evil.com", "http://x", "marie@acme.com", "a", "Bob 2"]) expect(SIGNER_NAME.test(name)).toBe(false);
  });
});
