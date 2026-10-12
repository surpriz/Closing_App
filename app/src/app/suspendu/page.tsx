import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SwitchAccountButton } from "@/components/auth/invitation-response";
import { isWorkspaceSuspended } from "@/lib/session";

export const metadata: Metadata = {
  title: "Espace suspendu",
  robots: { index: false, follow: false },
};

export default async function SuspendedPage() {
  if (!(await isWorkspaceSuspended())) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-background p-6 text-sm shadow-sm ring-1 ring-border">
        <h1 className="text-lg font-medium text-balance">Votre espace Clozer est suspendu.</h1>
        <p className="text-muted-foreground">
          Vos documents et vos deals sont conservés, mais l&apos;accès, les liens envoyés et les relances sont en pause.
          Contactez Clozer pour le réactiver.
        </p>
        <SwitchAccountButton next="/dashboard" />
      </div>
    </main>
  );
}
