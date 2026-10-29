import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink, organization } from "better-auth/plugins";

import { DEFAULT_UI_LOCALE, LOCALE_COOKIE, resolveUiLocale, type UiLocale } from "@/i18n/locale";
import { getTranslator } from "@/i18n/messages";
import { captureProductEvent } from "@/lib/analytics/server";
import { getPublicAppUrl } from "@/lib/app-origin";
import { syncSeats } from "@/lib/billing/seats";
import { getWorkspacePlan } from "@/lib/billing/workspace-plan";
import { inBackground } from "@/lib/closing/background";
import { disconnectMemberMailboxes } from "@/lib/mailboxes/disconnect-member";
import { prisma } from "@/lib/db";
import {
  devMagicLinksEnabled,
  rememberDevMagicLink,
} from "@/lib/dev-magic-links";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/email-layout";
import { buildInvitationEmail } from "@/lib/invitation-email";
import { bannedUserMessage, signupRefusalMessage } from "@/lib/login-messages";
import {
  PLATFORM_ADMIN_ROLE,
  SIGNUP_REFUSAL_CODES,
  type SignupRefusal,
  checkSignup,
  isPlatformAdminEmail,
  isUserBlocked,
  normalizeEmail,
  parseSignupMode,
} from "@/lib/platform-admin";
import { consumeLimit } from "@/lib/rate-limit";
import { getSellerLocale, toUiLocale } from "@/lib/seller-locale";

async function requireTeamPlan(organizationId: string) {
  const plan = await getWorkspacePlan(organizationId);
  if (!plan.limits.invites) {
    throw APIError.from("FORBIDDEN", { code: "PLAN_TEAM_REQUIRED", message: "Joining this workspace needs its Team plan." });
  }
}

export const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

// Blocklist and invite-only mode, for both magic link and Google sign-ups
async function signupRefusal(email: string) {
  const normalized = normalizeEmail(email);
  const [settings, blocked, allowed, invitation] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { signupMode: true } }),
    prisma.blockedEmail.findUnique({ where: { email: normalized }, select: { email: true } }),
    prisma.allowedEmail.findUnique({ where: { email: normalized }, select: { email: true } }),
    prisma.invitation.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" }, status: "pending", expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  return checkSignup({
    isAdmin: isPlatformAdminEmail(email),
    mode: parseSignupMode(settings?.signupMode),
    blocked: blocked !== null,
    allowed: allowed !== null,
    hasPendingInvitation: invitation !== null,
  });
}

// The code lets the magic link verify redirect to /login?error= instead of showing raw JSON
/** Language of a request made before sign-in: the cookie set by the switcher, else the browser. */
export function requestLocale(headers: Headers | null | undefined) {
  const cookie = headers?.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))?.[1];
  return resolveUiLocale({ cookie, acceptLanguage: headers?.get("accept-language") });
}

function signupError(refusal: SignupRefusal, locale: UiLocale) {
  return APIError.from("FORBIDDEN", { code: SIGNUP_REFUSAL_CODES[refusal], message: signupRefusalMessage(refusal, locale) });
}

// Why this email gets no sign-in link. Told by email, never on the login form:
// the form answers the same for everyone so nobody can probe who has an account
// Also gives the language to write in: the account's, else the requester's
async function magicLinkRefusal(email: string, headers: Headers | null | undefined) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
    select: { banned: true, banExpires: true, locale: true },
  });
  if (user) {
    const locale = toUiLocale(user.locale);
    return { locale, refusal: isUserBlocked(user) ? bannedUserMessage(locale) : null };
  }
  const locale = requestLocale(headers);
  const refusal = await signupRefusal(email);
  return { locale, refusal: refusal && signupRefusalMessage(refusal, locale) };
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Explicit rather than defaults: these are the answers a customer security review asks for
  session: { expiresIn: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  // Serverless instances share nothing in memory: counters live in the database
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    storage: "database",
    window: 60,
    max: 100,
    // A few sign-in links a minute per IP: enough for a typo, not for flooding someone's inbox
    customRules: { "/sign-in/magic-link": { window: 60, max: 5 } },
  },
  // Vercel sets x-real-ip itself: rate limits count the real client
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] } },
  // Tokens written before this was on stay readable and get encrypted on the next sign-in
  account: { encryptOAuthTokens: true },
  user: {
    additionalFields: {
      locale: { type: "string", required: false, defaultValue: "en", input: false },
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const refusal = await signupRefusal(user.email);
          const locale = requestLocale(ctx?.headers ?? ctx?.request?.headers);
          if (refusal) throw signupError(refusal, locale);
          const role = isPlatformAdminEmail(user.email) ? { role: PLATFORM_ADMIN_ROLE } : {};
          return { data: { ...user, ...role, locale } };
        },
        after: async (user) => captureProductEvent("signed_up", user.id),
      },
    },
    session: {
      create: {
        // PLATFORM_ADMIN_EMAIL changed: the former admin keeps no role behind
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, role: true } });
          if (user?.role === PLATFORM_ADMIN_ROLE && !isPlatformAdminEmail(user.email)) {
            await prisma.user.update({ where: { id: session.userId }, data: { role: "user" } });
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // The admin plugin trusts users.role; also require the configured email, so a
      // role set by mistake in the database never opens the admin endpoints
      if (!ctx.path.startsWith("/admin/")) return;
      const session = await getSessionFromCtx(ctx);
      if (ctx.path === "/admin/stop-impersonating" && session?.session.impersonatedBy) return;
      if (!isPlatformAdminEmail(session?.user.email)) throw new APIError("FORBIDDEN");
    }),
  },
  plugins: [
    organization({
      invitationExpiresIn: 7 * 24 * 60 * 60,
      // Re-inviting someone replaces the pending invitation instead of failing
      cancelPendingInvitationsOnReInvite: true,
      // Team is billed per member: the Stripe quantity follows every arrival and departure
      organizationHooks: {
        // Inviting is a Team feature (the settings action says it nicer first). Checked again on
        // acceptance: an invitation sent during the trial must not add a member once on Free or Solo
        beforeCreateInvitation: ({ organization }) => requireTeamPlan(organization.id),
        beforeAcceptInvitation: ({ organization }) => requireTeamPlan(organization.id),
        afterAddMember: async ({ organization }) => inBackground("seat-sync", () => syncSeats(organization.id)),
        afterAcceptInvitation: async ({ organization }) => inBackground("seat-sync", () => syncSeats(organization.id)),
        afterRemoveMember: async ({ organization, member }) => {
          inBackground("seat-sync", () => syncSeats(organization.id));
          // The mailbox is the member's own: once they leave the workspace, its stored password must go too
          inBackground("mailbox-disconnect", () => disconnectMemberMailboxes(organization.id, member.userId));
        },
      },
      sendInvitationEmail: async ({ id, email, organization, inviter }) => {
        const url = `${getPublicAppUrl()}/invitation/${id}`;
        if (!isEmailConfigured()) {
          // Local dev: the team settings show the link to copy
          if (process.env.NODE_ENV === "development") {
            console.info(`[auth] invitation for ${email}: ${url}`);
          }
          return;
        }

        // The invitee has no account yet: written in the inviter's language
        const { subject, html, text } = buildInvitationEmail({
          inviterName: inviter.user.name || inviter.user.email,
          workspaceName: organization.name,
          url,
          locale: await getSellerLocale(inviter.user.id),
        });
        await sendEmail({ to: email, subject, html, text });
      },
    }),
    magicLink({
      // Matches the "expires in 5 minutes" line of the email
      expiresIn: 5 * 60,
      sendMagicLink: async ({ email, url }, ctx) => {
        // Report only (the IP limit above blocks): many sign-in links for one inbox, from many IPs
        await consumeLimit("magicLinkEmail", ctx?.headers ?? new Headers(), `email:${normalizeEmail(email)}`);
        const { locale, refusal } = await magicLinkRefusal(email, ctx?.headers ?? ctx?.request?.headers);
        const t = getTranslator(locale);
        if (refusal) {
          if (devMagicLinksEnabled()) {
            console.info(`[auth] no magic link for ${email}: ${refusal}`);
            return;
          }
          await sendEmail({
            to: email,
            subject: t("emails.magicLink.refusalSubject"),
            html: `<p>${escapeHtml(refusal)}</p>`,
            text: refusal,
          });
          return;
        }

        if (devMagicLinksEnabled()) {
          rememberDevMagicLink(email, url);
          console.info(`[auth] magic link for ${email}: ${url}`);
          return;
        }

        await sendEmail({
          to: email,
          subject: t("emails.magicLink.subject"),
          html: `<p><a href="${url}">${escapeHtml(t("emails.magicLink.button"))}</a></p><p>${escapeHtml(t("emails.magicLink.expires"))}</p>`,
          text: t("emails.magicLink.textLine", { url }),
        });
      },
    }),
    admin({
      adminRoles: [PLATFORM_ADMIN_ROLE],
      impersonationSessionDuration: 60 * 60,
      // Fixed at boot, so one language; the login page shows its own text for BANNED_USER
      bannedUserMessage: bannedUserMessage(DEFAULT_UI_LOCALE),
    }),
    // must stay last so cookies set in server actions are forwarded
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
