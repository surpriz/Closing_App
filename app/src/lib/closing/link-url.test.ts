import { describe, expect, it } from "vitest";

import { bareSlug, shareLink, slugPrefix, viewerPath } from "./link-url";

describe("slugPrefix", () => {
  it("lowercases, drops accents and punctuation", () => {
    expect(slugPrefix(["Acme Group", "Devis rénovation cuisine"])).toBe("acme-group-devis-renovation-cuisine");
  });

  it("says the company once when the title repeats it", () => {
    expect(slugPrefix(["Acme", "Devis – Acme"])).toBe("acme-devis");
  });

  it("stops on a whole word", () => {
    const prefix = slugPrefix(["Société Générale des Grands Travaux", "Proposition commerciale détaillée 2026"]);
    expect(prefix.length).toBeLessThanOrEqual(48);
    expect(prefix).toBe("societe-generale-des-grands-travaux-proposition");
  });

  it("is empty with nothing usable", () => {
    expect(slugPrefix([null, "  ", "—"])).toBe("");
  });
});

describe("viewerPath", () => {
  const document = { name: "devis_v2.pdf", displayTitle: "Devis rénovation cuisine" };

  it("puts the company and the title before the slug", () => {
    expect(viewerPath({ slug: "mHiTw7Wdh4uT", document, company: "Acme" })).toBe(
      "/v/acme-devis-renovation-cuisine-mHiTw7Wdh4uT",
    );
  });

  it("falls back to the title alone", () => {
    expect(viewerPath({ slug: "mHiTw7Wdh4uT", document })).toBe("/v/devis-renovation-cuisine-mHiTw7Wdh4uT");
  });

  it("keeps the bare slug without a document", () => {
    expect(viewerPath({ slug: "mHiTw7Wdh4uT" })).toBe("/v/mHiTw7Wdh4uT");
  });
});

describe("shareLink", () => {
  it("gives the address and the title the prospect clicks on", () => {
    expect(
      shareLink("https://app.clozer.club", {
        slug: "mHiTw7Wdh4uT",
        document: { name: "x.pdf", displayTitle: "Devis rénovation cuisine" },
        company: "Acme",
      }),
    ).toEqual({
      url: "https://app.clozer.club/v/acme-devis-renovation-cuisine-mHiTw7Wdh4uT",
      title: "Devis rénovation cuisine – Acme",
    });
  });
});

describe("bareSlug", () => {
  it("reads the slug after the words", () => {
    expect(bareSlug("acme-devis-mHiTw7Wdh4uT")).toBe("mHiTw7Wdh4uT");
  });

  it("keeps an older address as is", () => {
    expect(bareSlug("mHiTw7Wdh4uT")).toBe("mHiTw7Wdh4uT");
  });

  it("refuses what cannot be a slug", () => {
    expect(bareSlug("acme-")).toBeNull();
    expect(bareSlug("acme-ab")).toBeNull();
    expect(bareSlug("../etc")).toBeNull();
  });
});
