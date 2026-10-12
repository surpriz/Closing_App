import { describe, expect, it } from "vitest";

import { maskLastName, normalizeLinkedinUrl, personKey, splitFullName } from "./dedupe";

describe("personKey", () => {
  it("matches a masked and a full last name", () => {
    const masked = personKey({ firstName: "Hélène", lastName: "Hu***n", companyName: "Acme Studio" });
    const full = personKey({ firstName: "helene", lastName: "Huguenin", companyName: "ACME studio" });
    expect(masked).toBe("helene|h|acmestudio");
    expect(full).toBe(masked);
  });

  it("is null when a part is missing", () => {
    expect(personKey({ firstName: "Marie", lastName: null, companyName: "Acme" })).toBeNull();
  });
});

describe("normalizeLinkedinUrl", () => {
  it("keeps only the profile slug", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/Jane-Doe/?utm=x")).toBe("linkedin.com/in/jane-doe");
    expect(normalizeLinkedinUrl("http://fr.linkedin.com/in/jane-doe")).toBe("linkedin.com/in/jane-doe");
    expect(normalizeLinkedinUrl("https://example.com")).toBeNull();
  });
});

describe("names", () => {
  it("splits and masks", () => {
    expect(splitFullName("Marie de la Tour")).toEqual({ first: "Marie", last: "de la Tour" });
    expect(maskLastName("Dupont")).toBe("D****t");
    expect(maskLastName("Li")).toBe("L*");
  });
});
