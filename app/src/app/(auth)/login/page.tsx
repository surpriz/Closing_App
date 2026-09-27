import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <LoginForm devMode={devMagicLinksEnabled()} />
    </main>
  );
}
