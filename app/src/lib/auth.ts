import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";

import { prisma } from "@/lib/db";
import {
  devMagicLinksEnabled,
  rememberDevMagicLink,
} from "@/lib/dev-magic-links";
import { sendEmail } from "@/lib/email";

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
    // must stay last so cookies set in server actions are forwarded
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
