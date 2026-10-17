import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { SwitchAccountButton } from "@/components/auth/invitation-response";
import { isWorkspaceSuspended } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.suspended");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function SuspendedPage() {
  if (!(await isWorkspaceSuspended())) redirect("/dashboard");
  const t = await getTranslations("auth.suspended");

  return (
    <>
      <ImpersonationBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md animate-rise space-y-4 rounded-xl bg-card p-6 text-body ring-1 ring-foreground/85 sm:p-8">
          <h1 className="condensed text-title">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
          <SwitchAccountButton next="/dashboard" />
        </div>
      </main>
    </>
  );
}
