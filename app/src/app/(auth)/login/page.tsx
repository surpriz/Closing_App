import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { ProductPanel } from "@/components/auth/product-panel";
import { googleEnabled } from "@/lib/auth";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { safeNextPath } from "@/lib/next-path";
import { loginErrorMessage } from "@/lib/platform-admin";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? "/dashboard";
  // A magic link that failed comes back here with ?error=
  const error = loginErrorMessage(typeof params.error === "string" ? params.error : undefined);
  const session = await getSession();
  if (session) redirect(next);

  // The landing's signup form lands here with ?email= (send the link at once) or ?provider=google.
  const email = typeof params.email === "string" ? params.email.trim().slice(0, 254) : "";
  const provider = params.provider === "google" && googleEnabled ? "google" : null;

  return (
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex items-center justify-center px-5 py-14 sm:px-8">
        <LoginForm
          devMode={devMagicLinksEnabled()}
          next={next}
          initialError={error}
          google={googleEnabled}
          initialEmail={error ? "" : email}
          autoStart={error ? null : provider ?? (email ? "email" : null)}
        />
      </div>
      <ProductPanel />
    </main>
  );
}
