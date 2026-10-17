import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

import { stopOnboardingEmails } from "./actions";

export const metadata: Metadata = { title: "Conseils de démarrage", robots: { index: false, follow: false } };

// Opening the page changes nothing: mail scanners follow links, the seller confirms with a click (POST)
export default async function OnboardingEmailsPage() {
  const { user, organization } = await requireWorkspace("/bienvenue/emails");
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    select: { onboardingEmailsOff: true },
  });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm animate-rise space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
        <Logo />
        {prefs?.onboardingEmailsOff ? (
          <p className="text-body">C&apos;est noté, vous ne recevrez plus ces conseils.</p>
        ) : (
          <form action={stopOnboardingEmails} className="space-y-4">
            <p className="text-body">
              Ces quelques emails vous aident à démarrer. Vos alertes et votre compte rendu du matin ne changent pas.
            </p>
            <Button type="submit" variant="outline">
              Ne plus recevoir ces conseils
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
