import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ToolSetup } from "@/components/onboarding/tool-setup";
import { documentUploadPrefix } from "@/lib/blob";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { guessMailClient } from "@/lib/closing/share/compose";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { connectedClients } from "@/lib/extension-tokens";
import { parseMailClient, safeReturnTo, SAMPLE_DOCUMENT } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaTitle") };
}

// Opens on its own the first time a seller lands on /dashboard, and stays
// reachable from the account menu for whoever wants the tour again
export default async function WelcomePage(props: PageProps<"/welcome">) {
  const { user, organization, role } = await requireWorkspace("/welcome");
  const query = await props.searchParams;
  const [prefs, tokens, settings] = await Promise.all([
    getSellerPrefs(user.id, organization.id),
    prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId: organization.id, revokedAt: null },
      select: { label: true },
    }),
    getWorkspaceSettings(organization.id),
  ]);
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;
  const connected = connectedClients(tokens);

  // Plugging in the mailbox, from the share screen tip: back to that screen when done
  if (query.step === "tool") {
    return (
      <ToolSetup
        firstName={firstName}
        initialMailClient={parseMailClient(prefs.mailClient)}
        connected={connected}
        account={{ email: user.email, workspace: organization.name }}
        chromeStoreUrl={getEnv().EXTENSION_STORE_URL ?? null}
        returnTo={safeReturnTo(query.from) ?? "/dashboard"}
      />
    );
  }

  // Replaying the tour: start from the latest document instead of adding it again
  const previous = prefs.onboardingCompletedAt
    ? await prisma.document.findFirst({
        where: {
          organizationId: organization.id,
          ownerId: user.id,
          archivedAt: null,
          status: "READY",
          name: { not: SAMPLE_DOCUMENT.name },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          links: {
            where: {
              createdById: user.id,
              draftAt: { not: null },
              archivedAt: null,
              isOnboardingTest: false,
              shared: false,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      })
    : null;

  return (
    <OnboardingWizard
      firstName={firstName}
      initialMailClient={parseMailClient(prefs.mailClient) ?? parseMailClient(guessMailClient(user.email))}
      connected={connected}
      chromeStoreUrl={getEnv().EXTENSION_STORE_URL ?? null}
      askOffer={isManagerRole(role) && !settings.offerDescription?.trim()}
      uploadPrefix={documentUploadPrefix(organization.id)}
      previous={
        previous
          ? { documentId: previous.id, linkId: previous.links[0]?.id ?? null, name: previous.name }
          : null
      }
    />
  );
}
