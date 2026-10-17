import { describe, expect, it } from "vitest";

import { loginErrorMessage } from "./login-messages";
import { checkSignup, isPlatformAdminEmail, isUserBlocked, parseSignupMode, userStatus } from "./platform-admin";

const ADMIN = "boss@clozer.test";

describe("isPlatformAdminEmail", () => {
  it("matches regardless of case and spaces", () => {
    expect(isPlatformAdminEmail(" Boss@Clozer.test ", ADMIN)).toBe(true);
  });

  it("rejects other emails", () => {
    expect(isPlatformAdminEmail("someone@clozer.test", ADMIN)).toBe(false);
  });

  it("rejects everyone when no admin is configured", () => {
    expect(isPlatformAdminEmail(ADMIN, undefined)).toBe(false);
    expect(isPlatformAdminEmail(ADMIN, "")).toBe(false);
  });
});

describe("checkSignup", () => {
  const base = { isAdmin: false, mode: "open" as const, blocked: false, allowed: false, hasPendingInvitation: false };

  it("lets anyone in when sign-ups are open", () => {
    expect(checkSignup(base)).toBeNull();
  });

  it("refuses a blocked email even when open", () => {
    expect(checkSignup({ ...base, blocked: true })).toBe("blocked");
  });

  it("refuses strangers when invite-only", () => {
    expect(checkSignup({ ...base, mode: "invite_only" })).toBe("closed");
  });

  it("lets allowed or invited emails in when invite-only", () => {
    expect(checkSignup({ ...base, mode: "invite_only", allowed: true })).toBeNull();
    expect(checkSignup({ ...base, mode: "invite_only", hasPendingInvitation: true })).toBeNull();
  });

  it("refuses a blocked email even with an invitation", () => {
    expect(checkSignup({ ...base, mode: "invite_only", hasPendingInvitation: true, blocked: true })).toBe("blocked");
  });

  it("always lets the admin in", () => {
    expect(checkSignup({ ...base, isAdmin: true, mode: "invite_only", blocked: true })).toBeNull();
  });
});

describe("isUserBlocked", () => {
  const now = new Date("2026-10-12T12:00:00Z");

  it("is false for a user who is not banned", () => {
    expect(isUserBlocked({ banned: false }, now)).toBe(false);
    expect(isUserBlocked({ banned: null }, now)).toBe(false);
  });

  it("is true for a ban without end date", () => {
    expect(isUserBlocked({ banned: true, banExpires: null }, now)).toBe(true);
  });

  it("follows the end date", () => {
    expect(isUserBlocked({ banned: true, banExpires: new Date("2026-10-13T00:00:00Z") }, now)).toBe(true);
    expect(isUserBlocked({ banned: true, banExpires: new Date("2026-10-11T00:00:00Z") }, now)).toBe(false);
  });
});

describe("userStatus", () => {
  it("is banned when the email is blocked", () => {
    expect(userStatus({ banned: true }, true)).toBe("banned");
  });

  it("is disabled for a ban alone", () => {
    expect(userStatus({ banned: true }, false)).toBe("disabled");
  });

  it("is active otherwise", () => {
    expect(userStatus({ banned: false }, false)).toBe("active");
  });
});

describe("parseSignupMode", () => {
  it("falls back to open", () => {
    expect(parseSignupMode("invite_only")).toBe("invite_only");
    expect(parseSignupMode("whatever")).toBe("open");
    expect(parseSignupMode(null)).toBe("open");
  });
});

describe("loginErrorMessage", () => {
  it("explains known codes in French", () => {
    expect(loginErrorMessage("SIGNUP_CLOSED", "fr")).toBe("Les inscriptions sont sur invitation pour le moment.");
    expect(loginErrorMessage("BANNED_USER", "fr")).toContain("désactivé");
  });

  it("speaks English too", () => {
    expect(loginErrorMessage("SIGNUP_CLOSED", "en")).toBe("Sign-ups are invite-only for now.");
  });

  it("has a fallback for unknown codes and nothing without one", () => {
    expect(loginErrorMessage("whatever", "fr")).toContain("nouveau lien");
    expect(loginErrorMessage(undefined, "fr")).toBeNull();
  });
});
