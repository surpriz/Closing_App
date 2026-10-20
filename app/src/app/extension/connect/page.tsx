import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/brand/logo";
import { ExtensionConnect } from "@/components/dashboard/extension-connect";
import { allowedExtensionIds, STORE_EXTENSION_URL } from "@/lib/extension-config";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.extension");
  return { title: t("connectTitle") };
}

// Opened by the extension popup, outside the dashboard layout so a signed-out
// seller comes back here after the magic link. The nonce comes back with the token so the
// extension only accepts the connection it asked for.
export default async function ExtensionConnectPage({ searchParams }: PageProps<"/extension/connect">) {
  const { nonce } = await searchParams;
  const safeNonce = typeof nonce === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(nonce) ? nonce : null;
  const { user, organization } = await requireWorkspace(
    `/extension/connect${safeNonce ? `?nonce=${safeNonce}` : ""}`,
  );
  const t = await getTranslations("auth.extension");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md animate-rise space-y-8">
        <Logo />
        <div className="space-y-2">
          <h1 className="text-title condensed">{t("connectTitle")}</h1>
          <p className="text-body text-muted-foreground">{t("connectLead")}</p>
        </div>
        <ExtensionConnect
          nonce={safeNonce}
          extensionIds={allowedExtensionIds()}
          storeUrl={STORE_EXTENSION_URL}
          account={{ email: user.email, workspace: organization.name }}
        />
      </div>
    </main>
  );
}
