import { describe, expect, it } from "vitest";

import { formatHelpContext, pageLabel, type HelpUserState } from "./context";

const state: HelpUserState = {
  firstName: "Camille",
  role: "member",
  workspaceName: "Acme",
  onboardingDone: false,
  mailClient: "gmail",
  documents: 2,
  activeLinks: 0,
  mailToolConnected: false,
  autopilot: false,
};

describe("pageLabel", () => {
  it("tells a document page from the document list", () => {
    expect(pageLabel("/documents")).toMatch(/^Documents/);
    expect(pageLabel("/documents/abc")).toMatch(/document page/);
  });

  it("knows prospect pages and settings", () => {
    expect(pageLabel("/links/xyz")).toMatch(/prospect page/);
    expect(pageLabel("/settings")).toBe("Réglages");
    expect(pageLabel("/settings", "en")).toBe("Settings");
  });

  it("returns null for unknown or missing paths", () => {
    expect(pageLabel("/somewhere")).toBeNull();
    expect(pageLabel(null)).toBeNull();
  });
});

describe("formatHelpContext", () => {
  it("states where the user is and how far they got", () => {
    const text = formatHelpContext(state, "/documents", "fr");
    expect(text).toContain("first name: Camille");
    expect(text).toContain("role: member");
    expect(text).toContain("welcome tour finished: no");
    expect(text).toContain("Chrome extension or Outlook add-in connected: no");
    expect(text).toContain("active links: 0");
    expect(text).toContain("follow-up mode: copilot");
    expect(text).toContain("<current_page>Documents");
  });

  it("names managers and autopilot", () => {
    const text = formatHelpContext({ ...state, role: "owner", autopilot: true }, null, "fr");
    expect(text).toContain("role: owner");
    expect(text).toContain("follow-up mode: autopilot");
    expect(text).toContain("<current_page>unknown</current_page>");
  });
});
