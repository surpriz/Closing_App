import { describe, expect, it } from "vitest";

import { buildMailto, MAILTO_MAX_LENGTH } from "./mailto";

describe("buildMailto", () => {
  it("encodes subject and body, keeps the @ readable", () => {
    const url = buildMailto({ to: "anne@acme.fr", subject: "Un point ?", body: "Bonjour Anne,\n\nÀ bientôt" });
    expect(url).toBe("mailto:anne@acme.fr?subject=Un%20point%20%3F&body=Bonjour%20Anne%2C%0D%0A%0D%0A%C3%80%20bient%C3%B4t");
  });

  it("leaves the subject out when there is none", () => {
    expect(buildMailto({ to: "a@b.co", subject: null, body: "Hi" })).toBe("mailto:a@b.co?body=Hi");
  });

  it("escapes characters that would break the query string", () => {
    const url = buildMailto({ to: "a@b.co", subject: "A & B", body: "x=1&y=2 #top" })!;
    expect(url).toContain("subject=A%20%26%20B");
    expect(url).toContain("body=x%3D1%26y%3D2%20%23top");
  });

  it("returns null past the safe length", () => {
    expect(buildMailto({ to: "a@b.co", subject: "s", body: "a".repeat(MAILTO_MAX_LENGTH) })).toBeNull();
  });
});
