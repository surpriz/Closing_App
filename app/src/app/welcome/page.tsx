import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ToolSetup } from "@/components/onboarding/tool-setup";
import { documentUploadPrefix } from "@/lib/blob";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { guessMailClient } from "@/lib/closing/share/compose";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { connectedClients } from "@/lib/extension-tokens";
import { parseMailClient } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Prise en main" };

// Opens on its own the first time a seller lands on /dashboard, and stays
// reachable from the account menu for whoever wants the tour again
export default async function WelcomePage(props: PageProps<"/bienvenue">) {
  const { user, organization, role } = await requireWorkspace("/bienvenue");
  const [prefs, tokens, settings] = await Promise.all([
    getSellerPrefs(user.id, organization.id),
    prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId: organization.id, revokedAt: null },
      select: { label: true },
    }),
    getWorkspaceSettings(organization.id),
  ]);
  const savedMailClient = parseMailClient(prefs.mailClient);
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;
  const connected = connectedClients(tokens);
  const chromeStoreUrl = getEnv().EXTENSION_STORE_URL ?? null;

  // Straight to plugging in the mailbox: share screen tip, settings, the tour's last step
  if ((await props.searchParams).etape === "outil") {
    return (
      <ToolSetup
        firstName={firstName}
        initialMailClient={savedMailClient}
        connected={connected}
        account={{ email: user.email, workspace: organization.name }}
        chromeStoreUrl={chromeStoreUrl}
      />
    );
  }

  return (
    <OnboardingWizard
      firstName={firstName}
      initialMailClient={savedMailClient ?? parseMailClient(guessMailClient(user.email))}
      connected={connected}
      askOffer={isManagerRole(role) && !settings.offerDescription?.trim()}
      uploadPrefix={documentUploadPrefix(organization.id)}
      chromeStoreUrl={chromeStoreUrl}
    />
  );
}
