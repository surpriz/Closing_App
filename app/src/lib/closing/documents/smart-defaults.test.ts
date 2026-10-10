import { describe, expect, it } from "vitest";

import { linkDefaultsFor, type WorkspaceLinkDefaults } from "./smart-defaults";

const workspace: WorkspaceLinkDefaults = {
  requireEmailByDefault: true,
  chatEnabledByDefault: true,
  voiceCommentsByDefault: false,
  followupsByDefault: true,
  quoteExpiryDays: 15,
};
const now = new Date("2026-10-10T10:00:00Z");

describe("linkDefaultsFor", () => {
  it("gives a quote a deadline at 23:59 local time and the Valider button", () => {
    const defaults = linkDefaultsFor("QUOTE", workspace, now, "Europe/Paris");
    expect(defaults.ctaEnabled).toBe(true);
    expect(defaults.expiresAt?.toISOString()).toBe("2026-10-25T22:59:00.000Z");
  });

  it("shares a brochure: one link, every reader identified, nothing to accept", () => {
    const defaults = linkDefaultsFor("BROCHURE", { ...workspace, requireEmailByDefault: false }, now, "Europe/Paris");
    expect(defaults).toMatchObject({ shared: true, requireEmail: true, ctaEnabled: false, followupsEnabled: false });
    expect(defaults.expiresAt).toBeNull();
  });

  it("keeps a brochure personal once it is for someone", () => {
    const defaults = linkDefaultsFor("BROCHURE", workspace, now, "Europe/Paris", { allowShared: false });
    expect(defaults).toMatchObject({ shared: false, ctaEnabled: false, followupsEnabled: true });
  });

  it("keeps a quote personal", () => {
    expect(linkDefaultsFor("QUOTE", workspace, now, "Europe/Paris").shared).toBe(false);
  });

  it("lets a contract be validated without a countdown", () => {
    const defaults = linkDefaultsFor("CONTRACT", workspace, now, "Europe/Paris");
    expect(defaults.ctaEnabled).toBe(true);
    expect(defaults.expiresAt).toBeNull();
  });

  it("stays on the workspace values while the type is unknown", () => {
    const defaults = linkDefaultsFor(null, workspace, now, "Europe/Paris");
    expect(defaults).toEqual({
      shared: false,
      requireEmail: true,
      chatEnabled: true,
      voiceCommentsEnabled: false,
      followupsEnabled: true,
      ctaEnabled: true,
      expiresAt: null,
    });
  });

  it("sets no deadline when the workspace turned it off", () => {
    expect(linkDefaultsFor("QUOTE", { ...workspace, quoteExpiryDays: null }, now, "Europe/Paris").expiresAt).toBeNull();
  });
});
