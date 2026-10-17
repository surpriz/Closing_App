// Platform admin: the one person who runs Clozer, set by PLATFORM_ADMIN_EMAIL.
// Not to be confused with a workspace "admin" (see roles.ts).

export const PLATFORM_ADMIN_ROLE = "admin";

export type SignupMode = "open" | "invite_only";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isPlatformAdminEmail(email: string | null | undefined, adminEmail = process.env.PLATFORM_ADMIN_EMAIL) {
  if (!email || !adminEmail) return false;
  return normalizeEmail(email) === normalizeEmail(adminEmail);
}

export function parseSignupMode(value: string | null | undefined): SignupMode {
  return value === "invite_only" ? "invite_only" : "open";
}

export type SignupCheck = {
  isAdmin: boolean;
  mode: SignupMode;
  blocked: boolean;
  allowed: boolean;
  hasPendingInvitation: boolean;
};

export type SignupRefusal = "blocked" | "closed";

/** Why a new account must not be created, or null when it can. */
export function checkSignup({ isAdmin, mode, blocked, allowed, hasPendingInvitation }: SignupCheck): SignupRefusal | null {
  if (isAdmin) return null;
  if (blocked) return "blocked";
  if (mode === "invite_only" && !allowed && !hasPendingInvitation) return "closed";
  return null;
}

export const SIGNUP_REFUSAL_CODES: Record<SignupRefusal, string> = {
  blocked: "SIGNUP_BLOCKED",
  closed: "SIGNUP_CLOSED",
};

// Messages for these codes, per language: login-messages.ts (server only)

type BanState = { banned?: boolean | null; banExpires?: Date | null };

/** Banned or disabled and the ban has not run out yet. */
export function isUserBlocked(user: BanState, now = new Date()) {
  if (!user.banned) return false;
  return !user.banExpires || user.banExpires.getTime() > now.getTime();
}

export type UserStatus = "active" | "disabled" | "banned";

/** Disabled = reversible ban; banned = ban plus the email on the blocklist. */
export function userStatus(user: BanState, emailBlocked: boolean, now = new Date()): UserStatus {
  if (emailBlocked) return "banned";
  return isUserBlocked(user, now) ? "disabled" : "active";
}
