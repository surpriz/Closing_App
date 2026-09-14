import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";
import { Resend } from "resend";

import { prisma } from "@/lib/db";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  plugins: [
    organization(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // created per call: importing this module must not require the key
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.AUTH_EMAIL_FROM!,
          to: email,
          subject: "Your sign-in link",
          html: `<p><a href="${url}">Sign in</a>. This link expires in 5 minutes.</p>`,
        });
      },
    }),
    // must stay last so cookies set in server actions are forwarded
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
