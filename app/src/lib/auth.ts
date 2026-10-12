import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink, organization } from "better-auth/plugins";

import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import {
  devMagicLinksEnabled,
  rememberDevMagicLink,
} from "@/lib/dev-magic-links";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildInvitationEmail } from "@/lib/invitation-email";
import {
  PLATFORM_ADMIN_ROLE,
  SIGNUP_REFUSAL_MESSAGES,
  checkSignup,
  isPlatformAdminEmail,
  normalizeEmail,
  parseSignupMode,
} from "@/lib/platform-admin";

const googleEnabled =
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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Tokens written before this was on stay readable and get encrypted on the next sign-in
  account: { encryptOAuthTokens: true },
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
        before: async (user) => {
          const refusal = await signupRefusal(user.email);
          if (refusal) throw new APIError("FORBIDDEN", { message: SIGNUP_REFUSAL_MESSAGES[refusal] });
          if (isPlatformAdminEmail(user.email)) return { data: { ...user, role: PLATFORM_ADMIN_ROLE } };
        },
      },
    },
  },
  hooks: {
    // The admin plugin trusts users.role; also require the configured email, so a
    // role set by mistake in the database never opens the admin endpoints
    before: createAuthMiddleware(async (ctx) => {
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
      sendInvitationEmail: async ({ id, email, organization, inviter }) => {
        const url = `${getPublicAppUrl()}/invitation/${id}`;
        if (!isEmailConfigured()) {
          // Local dev: the team settings show the link to copy
          if (process.env.NODE_ENV === "development") {
            console.info(`[auth] invitation for ${email}: ${url}`);
          }
          return;
        }

        const { subject, html, text } = buildInvitationEmail({
          inviterName: inviter.user.name || inviter.user.email,
          workspaceName: organization.name,
          url,
        });
        await sendEmail({ to: email, subject, html, text });
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (devMagicLinksEnabled()) {
          rememberDevMagicLink(email, url);
          console.info(`[auth] magic link for ${email}: ${url}`);
          return;
        }

        await sendEmail({
          to: email,
          subject: "Votre lien de connexion",
          html: `<p><a href="${url}">Se connecter</a></p><p>Ce lien expire dans 5 minutes.</p>`,
          text: `Se connecter : ${url}`,
        });
      },
    }),
    admin({
      adminRoles: [PLATFORM_ADMIN_ROLE],
      impersonationSessionDuration: 60 * 60,
      bannedUserMessage: "Votre compte est désactivé. Contactez le support si vous pensez que c'est une erreur.",
    }),
    // must stay last so cookies set in server actions are forwarded
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
