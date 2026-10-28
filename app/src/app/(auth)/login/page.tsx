import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { ProductPanel } from "@/components/auth/product-panel";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SIGNUP_SOURCE_COOKIE, appendSource, parseSource } from "@/lib/acquisition";
import { googleEnabled } from "@/lib/auth";
import { maskEmail } from "@/lib/closing/prospects/mask-email";
import { prisma } from "@/lib/db";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { safeNextPath } from "@/lib/next-path";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

// Codes Better Auth puts in ?error= when a magic link fails
const LOGIN_ERROR_CODES = ["SIGNUP_BLOCKED", "SIGNUP_CLOSED", "BANNED_USER", "INVALID_TOKEN", "EXPIRED_TOKEN"] as const;
type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? "/dashboard";
  // A magic link that failed comes back here with ?error=
  const t = await getTranslations("auth.login.errors");
  const code = typeof params.error === "string" ? params.error : undefined;
  const error = !code
    ? null
    : LOGIN_ERROR_CODES.includes(code as LoginErrorCode)
      ? t(code as LoginErrorCode)
      : t("fallback");
  const session = await getSession();
  if (session) redirect(next);

  // The landing's signup form lands here with ?email= (send the link at once) or ?provider=google.
  const email = typeof params.email === "string" ? params.email.trim().slice(0, 254) : "";
  const provider = params.provider === "google" && googleEnabled ? "google" : null;
  // From an invitation link, before any sign-in: the workspace and a masked address, nothing more
  const invitation = await pendingInvitation(next);
  const tInvite = await getTranslations("auth.invitation");
  // The magic link may open on another device: carry the campaign source in its callbackURL
  const source = parseSource((await cookies()).get(SIGNUP_SOURCE_COOKIE)?.value);
  const formNext = source ? appendSource(next, source) : next;

  return (
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative flex items-center justify-center px-5 py-14 sm:px-8">
        <div className="w-full max-w-[25rem] space-y-6">
          {invitation && (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-body ring-1 ring-foreground/85">
              {tInvite("loginNotice", { workspace: invitation.organization.name, email: maskEmail(invitation.email) })}
            </p>
          )}
          <LoginForm
            devMode={devMagicLinksEnabled()}
            next={formNext}
            initialError={error}
            google={googleEnabled}
            initialEmail={error ? "" : email}
            autoStart={error ? null : provider ?? (email ? "email" : null)}
          />
        </div>
        <LocaleSwitcher className="absolute right-5 bottom-5 sm:right-8" />
      </div>
      <ProductPanel />
    </main>
  );
}

const INVITATION_PATH = /^\/invitation\/([\w-]{1,64})$/;

async function pendingInvitation(next: string) {
  const id = INVITATION_PATH.exec(next)?.[1];
  if (!id) return null;
  return prisma.invitation.findFirst({
    where: { id, status: "pending", expiresAt: { gt: new Date() } },
    select: { email: true, organization: { select: { name: true } } },
  });
}
