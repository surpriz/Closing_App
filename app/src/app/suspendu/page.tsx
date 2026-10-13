import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { SwitchAccountButton } from "@/components/auth/invitation-response";
import { isWorkspaceSuspended } from "@/lib/session";

export const metadata: Metadata = {
  title: "Espace suspendu",
  robots: { index: false, follow: false },
};

export default async function SuspendedPage() {
  if (!(await isWorkspaceSuspended())) redirect("/dashboard");

  return (
    <>
      <ImpersonationBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md animate-rise space-y-4 rounded-xl bg-card p-6 text-body ring-1 ring-foreground/85 sm:p-8">
          <h1 className="condensed text-title">Votre espace Clozer est suspendu.</h1>
          <p className="text-muted-foreground">
            Vos documents et vos deals sont conservés, mais l&apos;accès, les liens envoyés et les relances sont en
            pause. Contactez Clozer pour le réactiver.
          </p>
          <SwitchAccountButton next="/dashboard" />
        </div>
      </main>
    </>
  );
}
