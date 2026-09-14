import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <LoginForm devMode={devMagicLinksEnabled()} />
    </main>
  );
}
