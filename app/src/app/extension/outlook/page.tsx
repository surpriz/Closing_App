import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { OutlookConnect } from "@/components/dashboard/outlook-connect";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Connecter Outlook" };

// Opened from the Outlook add-in in the seller's usual browser, where they are
// already signed in. The add-in can't reach this session, hence the code.
// The code is always typed, never taken from the URL (see /api/ext/pair).
export default async function OutlookConnectPage() {
  const { user, organization } = await requireWorkspace("/extension/outlook");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md animate-rise space-y-8">
        <Logo />
        <div className="space-y-2">
          <h1 className="text-title [font-stretch:92%]">Connecter Outlook</h1>
          <p className="text-body text-muted-foreground">
            Créez vos liens Clozer depuis Outlook sur Windows ou Mac.
          </p>
        </div>
        <OutlookConnect account={{ email: user.email, workspace: organization.name }} />
      </div>
    </main>
  );
}
