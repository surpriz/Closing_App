import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { ProductPanel } from "@/components/auth/product-panel";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16">
        <LoginForm devMode={devMagicLinksEnabled()} />
      </div>
      <ProductPanel />
    </main>
  );
}
