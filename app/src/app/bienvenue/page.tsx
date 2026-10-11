import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
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
  const [prefs, tokens, documentCount, settings] = await Promise.all([
    getSellerPrefs(user.id, organization.id),
    prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId: organization.id, revokedAt: null },
      select: { label: true },
    }),
    prisma.document.count({ where: { organizationId: organization.id, archivedAt: null } }),
    getWorkspaceSettings(organization.id),
  ]);
  const mailClient = parseMailClient(prefs.mailClient);
  // ?etape=outil, from the share screen tip: straight to the setup, once the mailbox is confirmed
  const toSetup = (await props.searchParams).etape === "outil" && mailClient;

  return (
    <OnboardingWizard
      firstName={user.name?.trim().split(/\s+/)[0] ?? null}
      account={{ email: user.email, workspace: organization.name }}
      initialMailClient={mailClient ?? parseMailClient(guessMailClient(user.email))}
      initialStep={toSetup ? "install" : "mail"}
      connected={connectedClients(tokens)}
      askOffer={isManagerRole(role) && !settings.offerDescription?.trim()}
      hasDocument={documentCount > 0}
      uploadPrefix={documentUploadPrefix(organization.id)}
      chromeStoreUrl={getEnv().EXTENSION_STORE_URL ?? null}
    />
  );
}
