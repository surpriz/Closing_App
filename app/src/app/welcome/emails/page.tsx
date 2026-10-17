import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

import { stopOnboardingEmails } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.emailsPage");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// Opening the page changes nothing: mail scanners follow links, the seller confirms with a click (POST)
export default async function OnboardingEmailsPage() {
  const { user, organization } = await requireWorkspace("/welcome/emails");
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    select: { onboardingEmailsOff: true },
  });
  const t = await getTranslations("onboarding.emailsPage");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm animate-rise space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
        <Logo />
        {prefs?.onboardingEmailsOff ? (
          <p className="text-body">{t("stopped")}</p>
        ) : (
          <form action={stopOnboardingEmails} className="space-y-4">
            <p className="text-body">{t("body")}</p>
            <Button type="submit" variant="outline">
              {t("stop")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
