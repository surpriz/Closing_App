import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { ProductPanel } from "@/components/auth/product-panel";
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

  return (
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16">
        <LoginForm devMode={devMagicLinksEnabled()} next={next} initialError={error} />
      </div>
      <ProductPanel />
    </main>
  );
}
